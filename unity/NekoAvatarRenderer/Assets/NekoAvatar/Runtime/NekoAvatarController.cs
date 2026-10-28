using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Threading;
using UniGLTF;
using UniGLTF.Utils;
using UniVRM10;
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.Scripting;

namespace Neko.Avatar
{
    [DisallowMultipleComponent]
    [DefaultExecutionOrder(12000)]
    [Preserve]
    public sealed class NekoAvatarController : MonoBehaviour
    {
        private sealed class RootTranslationFilteredPoseProvider : INormalizedPoseProvider
        {
            private readonly INormalizedPoseProvider _source;
            private readonly Vector3 _restHipsPosition;

            public RootTranslationFilteredPoseProvider(INormalizedPoseProvider source, ITPoseProvider tPose)
            {
                _source = source ?? throw new ArgumentNullException(nameof(source));
                var restHips = tPose != null ? tPose.GetWorldTransform(HumanBodyBones.Hips) : null;
                _restHipsPosition = restHips.HasValue
                    ? restHips.Value.Translation
                    : source.GetRawHipsPosition();
            }

            public Vector3 GetRawHipsPosition() => _restHipsPosition;

            public Quaternion GetNormalizedLocalRotation(HumanBodyBones bone, HumanBodyBones parentBone)
            {
                return _source.GetNormalizedLocalRotation(bone, parentBone);
            }
        }

        private sealed class FilteredVrmAnimation : IVrm10Animation
        {
            private readonly Vrm10AnimationInstance _inner;
            private readonly IReadOnlyDictionary<ExpressionKey, Func<float>> _expressions;
            private readonly (INormalizedPoseProvider, ITPoseProvider) _controlRig;

            public FilteredVrmAnimation(Vrm10AnimationInstance inner, bool suppressRootTranslation)
            {
                _inner = inner;
                var (pose, tPose) = inner.ControlRig;
                if (pose == null || tPose == null)
                {
                    throw new InvalidDataException("VRM Animation has no valid humanoid control rig");
                }
                _controlRig = suppressRootTranslation
                    ? ((INormalizedPoseProvider)new RootTranslationFilteredPoseProvider(pose, tPose), tPose)
                    : (pose, tPose);
                var expressions = new Dictionary<ExpressionKey, Func<float>>(ExpressionKey.Comparer);
                foreach (var pair in inner.ExpressionMap)
                {
                    if (!pair.Key.IsMouth && !pair.Key.IsBlink) expressions[pair.Key] = pair.Value;
                }
                _expressions = expressions;
            }

            public (INormalizedPoseProvider, ITPoseProvider) ControlRig => _controlRig;
            public IReadOnlyDictionary<ExpressionKey, Func<float>> ExpressionMap => _expressions;
            public LookAtInput? LookAt => null;
            public void ShowBoxMan(bool enable) => _inner.ShowBoxMan(enable);
            public void SetBoxManMaterial(Material material) => _inner.SetBoxManMaterial(material);
            public void Dispose() { }
        }

        private sealed class SnapshotTPoseProvider : ITPoseProvider
        {
            private readonly Dictionary<HumanBodyBones, EuclideanTransform> _transforms =
                new Dictionary<HumanBodyBones, EuclideanTransform>();

            public SnapshotTPoseProvider(ITPoseProvider source)
            {
                if (source == null) throw new ArgumentNullException(nameof(source));
                foreach (HumanBodyBones bone in Enum.GetValues(typeof(HumanBodyBones)))
                {
                    if (bone == HumanBodyBones.LastBone) continue;
                    var transform = source.GetWorldTransform(bone);
                    if (transform.HasValue) _transforms[bone] = transform.Value;
                }
                if (!_transforms.ContainsKey(HumanBodyBones.Hips))
                {
                    throw new InvalidDataException("VRM Animation T-pose has no hips transform");
                }
            }

            public EuclideanTransform? GetWorldTransform(HumanBodyBones bone)
            {
                return _transforms.TryGetValue(bone, out var transform)
                    ? transform
                    : (EuclideanTransform?)null;
            }
        }

        private sealed class AnimationLayer
        {
            public readonly RuntimeGltfInstance Root;
            public readonly IVrm10Animation Bridge;
            public readonly Animation Player;
            public float Weight { get; private set; }
            public bool PlaybackPaused;
            public bool Released;
            private float _fadeStartWeight;
            private float _fadeTargetWeight;
            private float _fadeDuration;
            private float _fadeElapsed;

            public AnimationLayer(
                RuntimeGltfInstance root,
                IVrm10Animation bridge,
                Animation player,
                float initialWeight)
            {
                Root = root;
                Bridge = bridge;
                Player = player;
                Weight = NekoAvatarProtocol.Clamp01(initialWeight);
                _fadeStartWeight = Weight;
                _fadeTargetWeight = Weight;
            }

            public bool IsRetired => _fadeTargetWeight <= 0f && Weight <= 0.00001f;

            public void FadeTo(float targetWeight, float duration)
            {
                _fadeStartWeight = Weight;
                _fadeTargetWeight = NekoAvatarProtocol.Clamp01(targetWeight);
                _fadeDuration = Mathf.Max(0f, duration);
                _fadeElapsed = 0f;
                if (_fadeDuration <= 0f) Weight = _fadeTargetWeight;
            }

            public void Advance(float deltaTime)
            {
                if (Mathf.Approximately(Weight, _fadeTargetWeight)) return;
                _fadeElapsed += Mathf.Max(0f, deltaTime);
                Weight = NekoAvatarProtocol.CalculateAnimationBlendWeight(
                    _fadeStartWeight,
                    _fadeTargetWeight,
                    _fadeElapsed,
                    _fadeDuration);
            }

            public void SetRuntimePaused(bool runtimePaused)
            {
                if (Player != null) Player.enabled = !runtimePaused && !PlaybackPaused;
            }
        }

        private sealed class LayeredVrmAnimation : IVrm10Animation, INormalizedPoseProvider
        {
            private readonly List<AnimationLayer> _layers = new List<AnimationLayer>();
            private readonly Dictionary<ExpressionKey, Func<float>> _expressions =
                new Dictionary<ExpressionKey, Func<float>>(ExpressionKey.Comparer);
            private readonly Dictionary<ExpressionKey, float> _expressionBaseWeights =
                new Dictionary<ExpressionKey, float>(ExpressionKey.Comparer);
            private readonly Dictionary<ExpressionKey, int> _expressionUseCounts =
                new Dictionary<ExpressionKey, int>(ExpressionKey.Comparer);
            private readonly Vrm10Instance _owner;
            private readonly Func<ExpressionKey, float> _expressionBaseWeightProvider;
            private SnapshotTPoseProvider _referenceTPose;

            public IReadOnlyList<AnimationLayer> Layers => _layers;
            public int Count => _layers.Count;
            public Vrm10Instance Owner => _owner;
            public (INormalizedPoseProvider, ITPoseProvider) ControlRig => (this, _referenceTPose);
            public IReadOnlyDictionary<ExpressionKey, Func<float>> ExpressionMap => _expressions;
            public LookAtInput? LookAt => null;

            public LayeredVrmAnimation() { }

            public LayeredVrmAnimation(
                Vrm10Instance owner,
                Func<ExpressionKey, float> expressionBaseWeightProvider)
            {
                _owner = owner;
                _expressionBaseWeightProvider = expressionBaseWeightProvider;
            }

            public void Add(AnimationLayer layer)
            {
                if (layer == null) throw new ArgumentNullException(nameof(layer));
                if (_referenceTPose == null)
                {
                    _referenceTPose = new SnapshotTPoseProvider(layer.Bridge.ControlRig.Item2);
                }
                _layers.Add(layer);
                foreach (var pair in layer.Bridge.ExpressionMap)
                {
                    var key = pair.Key;
                    if (_expressionUseCounts.TryGetValue(key, out var useCount))
                    {
                        _expressionUseCounts[key] = useCount + 1;
                        continue;
                    }
                    var baseWeight = _expressionBaseWeightProvider != null
                        ? _expressionBaseWeightProvider(key)
                        : 0f;
                    _expressionBaseWeights.Add(key, NekoAvatarProtocol.Clamp01(baseWeight));
                    _expressionUseCounts.Add(key, 1);
                    _expressions.Add(key, () => GetExpressionWeight(key));
                }
            }

            public void FadeExistingToZero(float duration)
            {
                foreach (var layer in _layers) layer.FadeTo(0f, duration);
            }

            public void Advance(float deltaTime, List<AnimationLayer> retired)
            {
                for (var index = _layers.Count - 1; index >= 0; --index)
                {
                    var layer = _layers[index];
                    layer.Advance(deltaTime);
                    if (!layer.IsRetired) continue;
                    _layers.RemoveAt(index);
                    RetireExpressionBindings(layer);
                    retired.Add(layer);
                }
            }

            public void Drain(List<AnimationLayer> retired)
            {
                for (var index = _layers.Count - 1; index >= 0; --index)
                {
                    var layer = _layers[index];
                    RetireExpressionBindings(layer);
                    retired.Add(layer);
                }
                _layers.Clear();
            }

            public Vector3 GetRawHipsPosition()
            {
                if (_referenceTPose == null) return Vector3.zero;
                var reference = _referenceTPose.GetWorldTransform(HumanBodyBones.Hips);
                if (!reference.HasValue) return Vector3.zero;
                var referenceHips = reference.Value.Translation;
                var accumulated = referenceHips;
                var accumulatedWeight = 0f;
                foreach (var layer in _layers)
                {
                    if (!(layer.Weight > 0f)) continue;
                    var rig = layer.Bridge.ControlRig;
                    var sourceRest = rig.Item2.GetWorldTransform(HumanBodyBones.Hips);
                    if (!sourceRest.HasValue) continue;
                    var hips = NekoAvatarProtocol.RetargetAnimationHipsToReference(
                        rig.Item1.GetRawHipsPosition(),
                        sourceRest.Value.Translation,
                        referenceHips);
                    accumulated = NekoAvatarProtocol.AccumulateAnimationVector(
                        accumulated,
                        accumulatedWeight,
                        hips,
                        layer.Weight,
                        out accumulatedWeight);
                }
                return NekoAvatarProtocol.FinalizeAnimationVector(
                    accumulated,
                    accumulatedWeight,
                    referenceHips);
            }

            public Quaternion GetNormalizedLocalRotation(HumanBodyBones bone, HumanBodyBones parentBone)
            {
                var accumulated = Quaternion.identity;
                var accumulatedWeight = 0f;
                foreach (var layer in _layers)
                {
                    if (!(layer.Weight > 0f)) continue;
                    var rotation = layer.Bridge.ControlRig.Item1.GetNormalizedLocalRotation(bone, parentBone);
                    accumulated = NekoAvatarProtocol.AccumulateAnimationRotation(
                        accumulated,
                        accumulatedWeight,
                        rotation,
                        layer.Weight,
                        out accumulatedWeight);
                }
                return NekoAvatarProtocol.FinalizeAnimationRotation(accumulated, accumulatedWeight);
            }

            public void ShowBoxMan(bool enable)
            {
                foreach (var layer in _layers) layer.Bridge.ShowBoxMan(enable);
            }

            public void SetBoxManMaterial(Material material)
            {
                foreach (var layer in _layers) layer.Bridge.SetBoxManMaterial(material);
            }

            public void Dispose() { }

            private void RetireExpressionBindings(AnimationLayer layer)
            {
                foreach (var pair in layer.Bridge.ExpressionMap)
                {
                    var key = pair.Key;
                    if (!_expressionUseCounts.TryGetValue(key, out var useCount)) continue;
                    if (useCount > 1)
                    {
                        _expressionUseCounts[key] = useCount - 1;
                        continue;
                    }
                    var baseWeight = _expressionBaseWeights.TryGetValue(key, out var original)
                        ? original
                        : 0f;
                    if (_owner != null) _owner.Runtime.Expression.SetWeight(key, baseWeight);
                    _expressionUseCounts.Remove(key);
                    _expressionBaseWeights.Remove(key);
                    _expressions.Remove(key);
                }
            }

            private float GetExpressionWeight(ExpressionKey key)
            {
                var weightedSum = 0f;
                var accumulatedWeight = 0f;
                foreach (var layer in _layers)
                {
                    var weight = Mathf.Max(0f, layer.Weight);
                    if (weight <= 0f || !layer.Bridge.ExpressionMap.TryGetValue(key, out var getter)) continue;
                    accumulatedWeight += weight;
                    weightedSum += NekoAvatarProtocol.Clamp01(getter()) * weight;
                }
                var baseWeight = _expressionBaseWeights.TryGetValue(key, out var original)
                    ? original
                    : 0f;
                return NekoAvatarProtocol.FinalizeAnimationScalar(
                    weightedSum,
                    accumulatedWeight,
                    baseWeight);
            }
        }

        [Serializable]
        private sealed class CommandEnvelope
        {
            public int v;
            public string id;
            public int generation;
            public string command;
            public CommandBody body = new CommandBody();
        }

        [Serializable]
        private sealed class ExpressionWeightBody
        {
            public string name;
            public float value;
        }

        [Serializable]
        private sealed class PoseBoneBody
        {
            public string name;
            public VectorBody eulerRadians;
            public float weight = 1f;
        }

        [Serializable]
        private sealed class AccessoryAnchorBody
        {
            public string name;
            public VectorBody localPosition;
        }

        [Serializable]
        private sealed class AnchorTrackBody
        {
            public string name;
            public string bone;
            public string accessoryId;
            public string anchor;
            public VectorBody localPosition;
        }

        [Serializable]
        private sealed class CommandBody
        {
            public string url;
            public string name;
            public string phase;
            public string quality;
            public string mode = "contain";
            public string align = "center";
            public string actionId;
            public string interactionId;
            public string id;
            public string poseId;
            public string preset;
            public string bone;
            public string accessoryId;
            public bool loop;
            public bool immediate;
            public bool isIdle;
            public bool movement;
            public bool paused;
            public bool animate;
            public bool clamp = true;
            public bool preservePending;
            public bool resetOthers;
            public bool enabled;
            public bool locked;
            public bool shadows;
            public bool reset;
            public bool visible = true;
            public bool awaitInitialAnimation;
            public bool autoScale = true;
            public float value;
            public float timeScale = 1f;
            public float fadeDuration;
            public float padding;
            public float scaleMultiplier = 1f;
            public float minWidth;
            public float minHeight;
            public float viewScale = 100f;
            public float viewX;
            public float viewY;
            public float aa;
            public float ih;
            public float ou;
            public float ee;
            public float oh;
            public float seconds;
            public float x;
            public float y;
            public float dx;
            public float dy;
            public float width;
            public float height;
            public float delta;
            public float factor;
            public float maxSpeed = 0.9f;
            public float acceleration = MovementAcceleration;
            public float deceleration = MovementDeceleration;
            public float arrival = MovementArrivalThreshold;
            public float pixelRatio;
            public float minVisiblePixels = NekoAvatarProtocol.DefaultMinVisiblePixels;
            public int targetFrameRate = -1;
            public int antiAliasing;
            public ExpressionWeightBody[] weights;
            public PoseBoneBody[] bones;
            public AccessoryAnchorBody[] anchors;
            public AnchorTrackBody[] tracks;
            public LightingBody lighting;
            public VectorBody rootOffset;
            public VectorBody eulerRadians;
            public VectorBody position;
            public VectorBody rotation;
            public VectorBody scale;
        }

        [Serializable]
        private sealed class LightingBody
        {
            public float ambient = 0.83f;
            public float main = 1.91f;
            public float fill;
            public float rim;
            public float top;
            public float bottom;
            public float exposure = 1.1f;
            public float toneMapping = 7f;
            public float outlineWidthScale = 1f;
        }

        [Serializable]
        private sealed class VectorBody
        {
            public float x;
            public float y;
            public float z;

            public VectorBody() { }
            public VectorBody(Vector3 value)
            {
                x = value.x;
                y = value.y;
                z = value.z;
            }
        }

        [Serializable]
        private sealed class TransformBody
        {
            public VectorBody position;
            public VectorBody rotation;
            public VectorBody scale;
        }

        [Serializable]
        private sealed class BoundsBody
        {
            public float minX;
            public float minY;
            public float maxX;
            public float maxY;
            public HeadProjectionBody head;
        }

        [Serializable]
        private sealed class HeadProjectionBody
        {
            public float x;
            public float y;
            public float minX;
            public float minY;
            public float maxX;
            public float maxY;
        }

        [Serializable]
        private sealed class QuaternionBody
        {
            public float x;
            public float y;
            public float z;
            public float w;

            public QuaternionBody(Quaternion value)
            {
                x = value.x;
                y = value.y;
                z = value.z;
                w = value.w;
            }
        }

        [Serializable]
        private sealed class BoneSnapshotBody
        {
            public string name;
            public VectorBody localPosition;
            public QuaternionBody localRotation;
        }

        [Serializable]
        private sealed class ExpressionSnapshotBody
        {
            public string name;
            public float value;
        }

        [Serializable]
        private sealed class AnchorScreenBody
        {
            public string name;
            public float x;
            public float y;
            public bool visible;
            public bool behindCamera;
        }

        [Serializable]
        private sealed class VmcSnapshotBody
        {
            public BoneSnapshotBody[] bones;
            public BoneSnapshotBody[] restPose;
            public ExpressionSnapshotBody[] expressions;
        }

        [Serializable]
        private sealed class VmcSnapshotEvent
        {
            public int v = NekoAvatarProtocol.Version;
            public string name = "vmc.snapshot";
            public string replyTo;
            public bool ok = true;
            public int generation;
            public VmcSnapshotBody body;
            public ErrorBody error;
        }

        [Serializable]
        private sealed class ModelProfileEvent
        {
            public int v = NekoAvatarProtocol.Version;
            public string name = "model.profile";
            public string replyTo;
            public bool ok = true;
            public int generation;
            public NekoAvatarProfileSnapshot body;
            public ErrorBody error;
        }

        [Serializable]
        private sealed class ResponseBody
        {
            public string id;
            public string url;
            public string actionId;
            public string[] expressions;
            public TransformBody transform;
            public BoundsBody bounds;
            public AnchorScreenBody[] anchors;
            public bool playing;
            public bool moved;
            public float duration;
            public float width;
            public float height;
            public int tracked;
            public bool needsRotation;
            public bool orientationReliable;
            public string orientationSource;
            public VectorBody currentRotation;
            public VectorBody suggestedRotation;
        }

        private sealed class PoseBoneState
        {
            public Transform Transform;
            public Quaternion RestRotation;
            public Quaternion DeltaRotation;
        }

        private sealed class AnchorTrackState
        {
            public string Name;
            public Transform Target;
            public Vector3 LocalPosition;
            public GameObject VisibilityRoot;
        }

        private sealed class OrbitState
        {
            public Vrm10Instance Avatar;
            public int ModelRevision;
            public int Generation;
            public string InteractionId;
            public Vector3 Pivot;
            public Vector3 StartPosition;
            public Quaternion StartRotation;
            public float StartX;
            public float StartY;
            public bool Moved;
        }

        private sealed class GuidedMovementState
        {
            public CommandEnvelope Envelope;
            public Vrm10Instance Avatar;
            public int ModelRevision;
            public string ActionId;
            public Vector3 Target;
            public float RestYaw;
            public float Velocity;
            public float MaxSpeed;
            public float Acceleration;
            public float Deceleration;
            public float ArrivalThreshold;
            public float MinVisiblePixels;
            public bool Moved;
            public bool Arrived;
            public bool RestoringYaw;
            public float RestoreStartYaw;
            public float RestoreDeltaYaw;
            public float RestoreElapsed;
            public float NextBoundsAt;
        }

        [Serializable]
        private sealed class ErrorBody
        {
            public string code;
            public string message;
        }

        [Serializable]
        private sealed class RuntimeEvent
        {
            public int v = NekoAvatarProtocol.Version;
            public string name;
            public string replyTo;
            public bool ok;
            public int generation;
            public ResponseBody body;
            public ErrorBody error;
        }

        private Camera _camera;
        private NekoAvatarToneMappingEffect _toneMapping;
        private Light _mainLight;
        private Light _fillLight;
        private Light _rimLight;
        private Light _topLight;
        private Light _bottomLight;
        private Transform _lookAtTarget;
        private Vrm10Instance _avatar;
        private RuntimeGltfInstance _animationRoot;
        private Vrm10AnimationInstance _vrma;
        private FilteredVrmAnimation _animationBridge;
        private Animation _animationPlayer;
        private LayeredVrmAnimation _layeredAnimation;
        private AnimationLayer _activeAnimationLayer;
        private readonly List<AnimationLayer> _retiredAnimationLayers = new List<AnimationLayer>();
        private CancellationTokenSource _modelLoadCancellation;
        private CancellationTokenSource _animationLoadCancellation;
        private int _generation;
        private int _modelRevision;
        private int _animationRevision;
        private int _snapRevision;
        private string _modelUrl;
        private string _animationUrl;
        private string _animationActionId;
        private string _modelPendingId;
        private int _modelPendingGeneration;
        private string _animationPendingId;
        private int _animationPendingGeneration;
        private bool _animationLoop;
        private bool _animationWasPlaying;
        private bool _animationSeekPaused;
        private int _lastAnimationLoop;
        private bool _paused;
        private bool _lookAtEnabled = true;
        private bool _interactionLocked;
        private float _surfaceWidth;
        private float _surfaceHeight;
        private float _nativeFitPixelsPerUnit = 1f;
        private Vector3[] _fitReferenceCorners;
        private float _targetMouth;
        private float _mouth;
        private bool _weightedVisemesActive;
        private readonly Dictionary<ExpressionKey, float> _visemeWeights =
            new Dictionary<ExpressionKey, float>(ExpressionKey.Comparer)
            {
                { ExpressionKey.Aa, 0f },
                { ExpressionKey.Ih, 0f },
                { ExpressionKey.Ou, 0f },
                { ExpressionKey.Ee, 0f },
                { ExpressionKey.Oh, 0f }
            };
        private readonly Dictionary<ExpressionKey, float> _expressionWeights =
            new Dictionary<ExpressionKey, float>(ExpressionKey.Comparer);
        private readonly Dictionary<Material, float> _outlineWidthBaselines =
            new Dictionary<Material, float>();
        private readonly List<Renderer> _initiallyHiddenRenderers = new List<Renderer>();
        private readonly List<Renderer> _modelVisibilityHiddenRenderers = new List<Renderer>();
        private readonly List<PoseBoneState> _activePoseBones = new List<PoseBoneState>();
        private readonly Dictionary<string, NekoAvatarAccessoryResource> _accessories =
            new Dictionary<string, NekoAvatarAccessoryResource>(StringComparer.Ordinal);
        private readonly List<AnchorTrackState> _anchorTracks = new List<AnchorTrackState>();
        private OrbitState _orbit;
        private GuidedMovementState _guidedMovement;
        private string _activePoseId;
        private Vector3 _poseRootOffset;
        private bool _awaitingInitialAnimation;
        private bool _modelVisible = true;
        private bool _initialAnimationRequested;
        private int _initialVisibilityRevision;
        private float _outlineWidthScale = 1f;
        private const string OutlineWidthProperty = "_OutlineWidth";
        private const float MinModelScale = 0.1f;
        private const float MaxModelScale = 50f;
        private const float AnimationStopFadeSeconds = 0.5f;
        private const float SnapDurationSeconds = 0.26f;
        private const float MovementAcceleration = 2.8f;
        private const float MovementDeceleration = 4.2f;
        private const float MovementArrivalThreshold = 0.012f;
        private const float MovementRestoreYawSeconds = 0.36f;
        private const float MovementBoundsIntervalSeconds = 0.05f;

        private void Awake()
        {
            gameObject.name = NekoAvatarProtocol.ControllerObjectName;
            Application.runInBackground = true;
            Application.targetFrameRate = 60;
            QualitySettings.vSyncCount = 0;
            QualitySettings.antiAliasing = 2;
            QualitySettings.pixelLightCount = Mathf.Max(QualitySettings.pixelLightCount, 5);
            _surfaceWidth = Mathf.Max(1, Screen.width);
            _surfaceHeight = Mathf.Max(1, Screen.height);
            ConfigureScene();
        }

        private void Start()
        {
            Emit("renderer.ready", body: new ResponseBody());
        }

        private void Update()
        {
            if (_paused || _avatar == null) return;
            UpdateGuidedMovement(Time.unscaledDeltaTime);
            AdvanceAnimationBlend(Time.unscaledDeltaTime);
            UpdateMouth();
            UpdateAnimationEvents();
        }

        private void LateUpdate()
        {
            if (_paused || _avatar == null) return;
            ApplyActivePose();
            EmitTrackedAnchors();
        }

        private void OnDestroy()
        {
            CancelModelLoad(false);
            CancelAnimationLoad(false);
            ReleaseAnimation();
            ReleaseAvatar();
        }

        [Preserve]
        public void HandleCommand(string json)
        {
            var envelope = ParseEnvelope(json);
            if (envelope == null)
            {
                EmitError(null, _generation, "invalid_envelope", "Unity command is not valid JSON");
                return;
            }
            if (envelope.v != NekoAvatarProtocol.Version || string.IsNullOrWhiteSpace(envelope.command))
            {
                EmitError(envelope.id, envelope.generation, "unsupported_protocol", "Unsupported Unity avatar protocol");
                return;
            }

            if (envelope.body == null) envelope.body = new CommandBody();
            try { Dispatch(envelope); }
            catch (Exception error)
            {
                EmitError(envelope.id, envelope.generation, "command_failed", error.Message);
            }
        }

        private void Dispatch(CommandEnvelope envelope)
        {
            if (IsStaleGeneration(envelope))
            {
                EmitError(
                    envelope.id,
                    envelope.generation,
                    "stale_generation",
                    "Command targets an inactive model generation");
                return;
            }

            switch (envelope.command)
            {
                case "model.load": BeginModelLoad(envelope); return;
                case "model.unload":
                    CancelOrbit();
                    CancelGuidedMovement();
                    ++_snapRevision;
                    _generation = envelope.generation;
                    ++_modelRevision;
                    ++_animationRevision;
                    CancelModelLoad(true);
                    CancelAnimationLoad(true);
                    ReleaseAnimation();
                    ReleaseAvatar();
                    ReplyOk(envelope, "model.unloaded");
                    return;
                case "model.transform": ApplyModelTransform(envelope.body); break;
                case "model.dragPixels": DragModel(envelope.body); break;
                case "model.zoom": ZoomModel(envelope.body.delta, envelope.body.factor); break;
                case "model.orbit": HandleModelOrbit(envelope); return;
                case "model.moveToScreen": BeginGuidedMovement(envelope); return;
                case "model.moveCancel": CancelGuidedMovementCommand(envelope); return;
                case "model.visibility": SetModelVisibility(envelope.body.visible); break;
                case "model.fit": ApplyModelFit(envelope); return;
                case "model.snap": SnapModelIntoScreen(envelope); return;
                case "model.snapshot": ReplyModelSnapshot(envelope); return;
                case "model.profile": ReplyModelProfile(envelope); return;
                case NekoAvatarProtocol.ModelOrientationCommand: ReplyModelOrientation(envelope); return;
                case "animation.play": BeginAnimationLoad(envelope); return;
                case "animation.stop": StopAnimation(envelope); break;
                case "animation.seek": SeekAnimation(envelope.body.seconds, envelope.body.paused); break;
                case "animation.setPaused": SetAnimationPaused(envelope); return;
                case "pose.set": SetPose(envelope); return;
                case "pose.reset": ResetPose(envelope); return;
                case "accessory.attach": AttachAccessory(envelope); return;
                case "accessory.setVisible": SetAccessoryVisible(envelope); return;
                case "accessory.detach": DetachAccessory(envelope); return;
                case "anchor.track": TrackAnchors(envelope); return;
                case "expression.set": SetExpression(envelope.body); break;
                case "expression.setWeights": SetExpressionWeights(envelope.body); break;
                case "expression.reset": ResetExpressions(); break;
                case "viseme.set": SetViseme(envelope.body); break;
                case "viseme.setWeights": SetVisemeWeights(envelope.body); break;
                case "render.settings": ApplyLighting(envelope.body.lighting); break;
                case "render.quality": ApplyQuality(envelope.body); break;
                case "render.pause": SetPaused(true); break;
                case "render.resume": SetPaused(false); break;
                case "surface.resize": ResizeSurface(envelope.body); break;
                case NekoAvatarProtocol.SurfaceSyncCommand: StartCoroutine(ReplyAfterEndOfFrame(envelope)); return;
                case "surface.clear": ClearSurface(); break;
                case "lookAt.pointer": ApplyPointerLookAt(envelope.body); break;
                case "lookAt.enable": SetLookAtEnabled(envelope.body.enabled); break;
                case "lookAt.faceCamera": SetLookAtEnabled(envelope.body.enabled); break;
                case "lookAt.quality": break;
                case "interaction.lock": SetInteractionLocked(envelope.body.locked); break;
                case "interaction.drag": break;
                case "vmc.snapshot": ReplyVmcSnapshot(envelope); return;
                default:
                    EmitError(envelope.id, envelope.generation, "unknown_command", "Unknown command: " + envelope.command);
                    return;
            }

            ReplyOk(envelope, envelope.command + ".applied");
        }

        private bool IsStaleGeneration(CommandEnvelope envelope)
        {
            if (envelope == null) return true;
            switch (envelope.command)
            {
                // These commands intentionally open a new model epoch. A late
                // transition may not move the runtime back to an older epoch.
                case "model.load":
                case "model.unload":
                    return envelope.generation < _generation;
            }

            return RequiresCurrentModelGeneration(envelope.command) &&
                   envelope.generation != _generation;
        }

        private static bool RequiresCurrentModelGeneration(string command)
        {
            if (string.IsNullOrEmpty(command)) return false;
            return command.StartsWith("model.", StringComparison.Ordinal) ||
                   command.StartsWith("animation.", StringComparison.Ordinal) ||
                   command.StartsWith("pose.", StringComparison.Ordinal) ||
                   command.StartsWith("accessory.", StringComparison.Ordinal) ||
                   command.StartsWith("anchor.", StringComparison.Ordinal) ||
                   command.StartsWith("expression.", StringComparison.Ordinal) ||
                   command.StartsWith("viseme.", StringComparison.Ordinal) ||
                   command == "lookAt.pointer" ||
                   command == "lookAt.faceCamera" ||
                   command == "vmc.snapshot";
        }

        private void ConfigureScene()
        {
            _camera = Camera.main;
            if (_camera == null)
            {
                var cameraObject = new GameObject("AvatarCamera");
                cameraObject.transform.SetParent(transform, false);
                cameraObject.tag = "MainCamera";
                _camera = cameraObject.AddComponent<Camera>();
            }
            _camera.clearFlags = CameraClearFlags.SolidColor;
            _camera.backgroundColor = new Color(0f, 0f, 0f, 0f);
            _camera.allowHDR = false;
            _camera.allowMSAA = true;
            _camera.orthographic = true;
            _camera.nearClipPlane = 0.01f;
            _camera.farClipPlane = 100f;
            _toneMapping = _camera.GetComponent<NekoAvatarToneMappingEffect>();
            if (_toneMapping == null)
            {
                _toneMapping = _camera.gameObject.AddComponent<NekoAvatarToneMappingEffect>();
            }
            _toneMapping.Configure(7f, 1.1f);

            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = Color.white * 0.83f;
            _mainLight = CreateDirectionalLight(
                "AvatarKeyLight",
                new Vector3(0f, -1f, -3f),
                Color.white,
                1.91f);
            _fillLight = CreateDirectionalLight(
                "AvatarFillLight",
                new Vector3(2f, -1f, -2f),
                Color.white,
                0f);
            _rimLight = CreateDirectionalLight(
                "AvatarRimLight",
                new Vector3(0f, -1f, 2f),
                Color.white,
                0f);
            _topLight = CreateDirectionalLight(
                "AvatarTopLight",
                Vector3.down,
                Color.white,
                0f);
            _bottomLight = CreateDirectionalLight(
                "AvatarBottomLight",
                new Vector3(0f, 1f, -1f),
                Color.white,
                0f);
            _lookAtTarget = new GameObject("AvatarLookAtTarget").transform;
            _lookAtTarget.SetParent(transform, false);
        }

        private Light CreateDirectionalLight(
            string objectName,
            Vector3 direction,
            Color color,
            float intensity,
            LightShadows shadows = LightShadows.None)
        {
            var lightObject = new GameObject(objectName);
            lightObject.transform.SetParent(transform, false);
            lightObject.transform.rotation = Quaternion.FromToRotation(Vector3.forward, direction.normalized);
            var light = lightObject.AddComponent<Light>();
            light.type = LightType.Directional;
            light.color = color;
            light.intensity = intensity;
            light.enabled = intensity > 0f;
            light.shadows = shadows;
            return light;
        }

        private void BeginModelLoad(CommandEnvelope envelope)
        {
            CancelOrbit();
            CancelGuidedMovement();
            ++_snapRevision;
            CancelModelLoad(true);
            RevealAvatarAfterInitialAnimation();
            ++_animationRevision;
            CancelAnimationLoad(true);
            _generation = envelope.generation;
            if (!NekoAvatarProtocol.TryNormalizeAssetUrl(envelope.body.url, out var url))
            {
                EmitError(envelope.id, envelope.generation, "invalid_model_url", "Invalid VRM URL");
                return;
            }

            _modelPendingId = envelope.id;
            _modelPendingGeneration = envelope.generation;
            _modelLoadCancellation = new CancellationTokenSource();
            var revision = ++_modelRevision;
            StartCoroutine(DownloadModel(
                url,
                envelope.body.awaitInitialAnimation,
                revision,
                envelope.generation,
                envelope.id,
                _modelLoadCancellation.Token));
        }

        private IEnumerator DownloadModel(
            string url,
            bool awaitInitialAnimation,
            int revision,
            int generation,
            string commandId,
            CancellationToken token)
        {
            using (var request = UnityWebRequest.Get(url))
            {
                request.timeout = 90;
                var operation = request.SendWebRequest();
                while (!operation.isDone)
                {
                    if (token.IsCancellationRequested)
                    {
                        request.Abort();
                        yield break;
                    }
                    yield return null;
                }
                if (revision != _modelRevision || generation != _generation || token.IsCancellationRequested) yield break;
                if (request.result != UnityWebRequest.Result.Success)
                {
                    CompleteModelFailure(commandId, generation, "model_download_failed", request.error);
                    yield break;
                }
                var bytes = request.downloadHandler.data;
                if (bytes == null || bytes.Length == 0)
                {
                    CompleteModelFailure(commandId, generation, "empty_model", "VRM response was empty");
                    yield break;
                }
                ImportModel(bytes, url, awaitInitialAnimation, revision, generation, commandId, token);
            }
        }

        private async void ImportModel(
            byte[] bytes,
            string url,
            bool awaitInitialAnimation,
            int revision,
            int generation,
            string commandId,
            CancellationToken token)
        {
            Vrm10Instance loaded = null;
            Vrm10Instance previous = null;
            string previousUrl = null;
            Vector3[] previousFitReference = null;
            bool previousModelVisible = true;
            List<Renderer> previousVisibilityHidden = null;
            var candidateSelected = false;
            var committed = false;
            try
            {
                loaded = await Vrm10.LoadBytesAsync(
                    bytes,
                    canLoadVrm0X: true,
                    showMeshes: true,
                    awaitCaller: CreateAwaitCaller(),
                    ct: token);
                if (loaded == null) throw new InvalidOperationException("UniVRM returned no model instance");
                if (revision != _modelRevision || generation != _generation || token.IsCancellationRequested)
                {
                    Destroy(loaded.gameObject);
                    return;
                }

                previous = _avatar;
                previousUrl = _modelUrl;
                previousFitReference = _fitReferenceCorners;
                previousModelVisible = _modelVisible;
                previousVisibilityHidden = new List<Renderer>(_modelVisibilityHiddenRenderers);
                _avatar = loaded;
                _modelUrl = url;
                candidateSelected = true;
                ConfigureLoadedAvatar();
                var body = BuildModelResponse();

                if (awaitInitialAnimation) HideAvatarUntilInitialAnimation(revision);
                else RevealAvatarAfterInitialAnimation();
                Emit("model.loaded", commandId, true, generation, body);

                ReleaseAnimation();
                ClearPoseState(false);
                ClearAccessories();
                _anchorTracks.Clear();
                if (previous != null)
                {
                    RemoveOutlineMaterialBaselines(previous);
                    Destroy(previous.gameObject);
                }
                committed = true;
                ClearModelPending(commandId);
                DisposeCompletedModelLoad();
                StartCoroutine(EmitBoundsAfterStableFrame(revision, generation));
            }
            catch (OperationCanceledException)
            {
                if (!committed)
                {
                    if (candidateSelected) RestorePreviousAvatar(
                        previous, previousUrl, previousFitReference, previousModelVisible, previousVisibilityHidden);
                    if (loaded != null)
                    {
                        RemoveOutlineMaterialBaselines(loaded);
                        Destroy(loaded.gameObject);
                    }
                }
            }
            catch (Exception error)
            {
                if (!committed)
                {
                    if (candidateSelected) RestorePreviousAvatar(
                        previous, previousUrl, previousFitReference, previousModelVisible, previousVisibilityHidden);
                    if (loaded != null)
                    {
                        RemoveOutlineMaterialBaselines(loaded);
                        Destroy(loaded.gameObject);
                    }
                }
                if (revision == _modelRevision && generation == _generation)
                {
                    CompleteModelFailure(commandId, generation, "model_import_failed", error.Message);
                }
            }
        }

        private void RestorePreviousAvatar(
            Vrm10Instance previous,
            string previousUrl,
            Vector3[] previousFitReference,
            bool previousModelVisible,
            List<Renderer> previousVisibilityHidden)
        {
            AbandonInitiallyHiddenAvatar();
            _avatar = previous;
            _modelUrl = previousUrl;
            _fitReferenceCorners = previousFitReference;
            _modelVisible = previousModelVisible;
            _modelVisibilityHiddenRenderers.Clear();
            if (previousVisibilityHidden != null) _modelVisibilityHiddenRenderers.AddRange(previousVisibilityHidden);
            if (_avatar != null)
            {
                FitCameraToAvatar();
                CaptureNativeFitBaseline();
                ApplyPointerLookAt(new CommandBody { x = _surfaceWidth * 0.5f, y = _surfaceHeight * 0.5f });
            }
        }

        private void ConfigureLoadedAvatar()
        {
            _modelVisible = true;
            _modelVisibilityHiddenRenderers.Clear();
            _avatar.UpdateType = _paused ? Vrm10Instance.UpdateTypes.None : Vrm10Instance.UpdateTypes.LateUpdate;
            _avatar.LookAtTarget = _lookAtEnabled ? _lookAtTarget : null;
            _avatar.LookAtTargetType = VRM10ObjectLookAt.LookAtTargetTypes.SpecifiedTransform;
            _avatar.transform.position = Vector3.zero;
            _avatar.transform.rotation = Quaternion.identity;
            _avatar.transform.localScale = Vector3.one;
            FitCameraToAvatar();
            CaptureNativeFitBaseline();
            CaptureFitReferenceBounds();
            ApplyOutlineWidthScale(_outlineWidthScale);
            ApplyPointerLookAt(new CommandBody { x = _surfaceWidth * 0.5f, y = _surfaceHeight * 0.5f });
            _targetMouth = 0f;
            _mouth = 0f;
            _weightedVisemesActive = false;
            ClearVisemeWeights();
        }

        private void HideAvatarUntilInitialAnimation(int revision)
        {
            RevealAvatarAfterInitialAnimation();
            if (_avatar == null) return;
            foreach (var renderer in _avatar.GetComponentsInChildren<Renderer>(true))
            {
                if (renderer.forceRenderingOff) continue;
                renderer.forceRenderingOff = true;
                _initiallyHiddenRenderers.Add(renderer);
            }
            _awaitingInitialAnimation = true;
            _initialAnimationRequested = false;
            _initialVisibilityRevision = revision;
            StartCoroutine(RevealAvatarIfNoAnimationRequested(revision));
            StartCoroutine(RevealAvatarAfterMaximumWait(revision));
        }

        private IEnumerator RevealAvatarIfNoAnimationRequested(int revision)
        {
            yield return new WaitForSecondsRealtime(NekoAvatarProtocol.InitialAnimationFallbackSeconds);
            if (!_awaitingInitialAnimation || _initialAnimationRequested ||
                revision != _initialVisibilityRevision || revision != _modelRevision)
            {
                yield break;
            }
            RevealAvatarAfterInitialAnimation();
        }

        private IEnumerator RevealAvatarAfterMaximumWait(int revision)
        {
            yield return new WaitForSecondsRealtime(NekoAvatarProtocol.InitialAnimationHardFallbackSeconds);
            if (!_awaitingInitialAnimation ||
                revision != _initialVisibilityRevision || revision != _modelRevision)
            {
                yield break;
            }
            RevealAvatarAfterInitialAnimation();
        }

        private void RevealAvatarAfterInitialAnimation()
        {
            foreach (var renderer in _initiallyHiddenRenderers)
            {
                if (renderer == null) continue;
                if (_modelVisible) renderer.forceRenderingOff = false;
                else if (!_modelVisibilityHiddenRenderers.Contains(renderer)) _modelVisibilityHiddenRenderers.Add(renderer);
            }
            _initiallyHiddenRenderers.Clear();
            _awaitingInitialAnimation = false;
            _initialAnimationRequested = false;
        }

        private void SetModelVisibility(bool visible)
        {
            _modelVisible = visible;
            if (_avatar == null) return;
            if (!visible)
            {
                foreach (var renderer in _avatar.GetComponentsInChildren<Renderer>(true))
                {
                    if (!renderer.forceRenderingOff)
                    {
                        renderer.forceRenderingOff = true;
                        _modelVisibilityHiddenRenderers.Add(renderer);
                    }
                }
                return;
            }

            foreach (var renderer in _modelVisibilityHiddenRenderers)
            {
                if (renderer != null && (!_awaitingInitialAnimation || !_initiallyHiddenRenderers.Contains(renderer)))
                {
                    renderer.forceRenderingOff = false;
                }
            }
            _modelVisibilityHiddenRenderers.Clear();
        }

        private void AbandonInitiallyHiddenAvatar()
        {
            _initiallyHiddenRenderers.Clear();
            _awaitingInitialAnimation = false;
            _initialAnimationRequested = false;
        }

        private void BeginAnimationLoad(CommandEnvelope envelope)
        {
            if (_avatar == null)
            {
                EmitError(envelope.id, envelope.generation, "model_not_loaded", "No VRM model is loaded");
                return;
            }
            if (envelope.generation != _generation)
            {
                EmitError(envelope.id, envelope.generation, "stale_generation", "Animation targets an inactive model generation");
                return;
            }
            if (!NekoAvatarProtocol.TryNormalizeAssetUrl(envelope.body.url, out var url))
            {
                RevealAvatarAfterInitialAnimation();
                EmitError(envelope.id, envelope.generation, "invalid_animation_url", "Invalid VRMA URL");
                return;
            }

            CancelAnimationLoad(true);
            if (_awaitingInitialAnimation) _initialAnimationRequested = true;
            _animationPendingId = envelope.id;
            _animationPendingGeneration = envelope.generation;
            _animationLoadCancellation = new CancellationTokenSource();
            var revision = ++_animationRevision;
            StartCoroutine(DownloadAnimation(
                url,
                envelope.body.loop,
                envelope.body.timeScale,
                envelope.body.fadeDuration,
                envelope.body.immediate,
                envelope.body.movement,
                envelope.body.actionId,
                revision,
                envelope.generation,
                envelope.id,
                _animationLoadCancellation.Token));
        }

        private IEnumerator DownloadAnimation(
            string url,
            bool loop,
            float timeScale,
            float fadeDuration,
            bool immediate,
            bool movement,
            string actionId,
            int revision,
            int generation,
            string commandId,
            CancellationToken token)
        {
            using (var request = UnityWebRequest.Get(url))
            {
                request.timeout = 60;
                var operation = request.SendWebRequest();
                while (!operation.isDone)
                {
                    if (token.IsCancellationRequested)
                    {
                        request.Abort();
                        yield break;
                    }
                    yield return null;
                }
                if (revision != _animationRevision || generation != _generation || token.IsCancellationRequested) yield break;
                if (request.result != UnityWebRequest.Result.Success)
                {
                    CompleteAnimationFailure(commandId, generation, "animation_download_failed", request.error);
                    yield break;
                }
                try
                {
                    ImportAnimation(
                        InflateIfNeeded(request.downloadHandler.data),
                        url,
                        loop,
                        timeScale,
                        fadeDuration,
                        immediate,
                        movement,
                        actionId,
                        revision,
                        generation,
                        commandId,
                        token);
                }
                catch (Exception error)
                {
                    CompleteAnimationFailure(commandId, generation, "animation_decode_failed", error.Message);
                }
            }
        }

        private async void ImportAnimation(
            byte[] bytes,
            string url,
            bool loop,
            float timeScale,
            float fadeDuration,
            bool immediate,
            bool movement,
            string actionId,
            int revision,
            int generation,
            string commandId,
            CancellationToken token)
        {
            RuntimeGltfInstance loadedRoot = null;
            var adopted = false;
            var published = false;
            try
            {
                using (var data = GlbLowLevelParser.Parse(string.Empty, bytes))
                using (var importer = new VrmAnimationImporter(new VrmAnimationData(data)))
                {
                    loadedRoot = await importer.LoadAsync(CreateAwaitCaller());
                }
                if (loadedRoot == null) throw new InvalidOperationException("UniVRM returned no VRMA instance");
                if (revision != _animationRevision || generation != _generation || token.IsCancellationRequested)
                {
                    Destroy(loadedRoot.gameObject);
                    return;
                }

                var vrma = loadedRoot.GetComponent<Vrm10AnimationInstance>();
                var player = loadedRoot.GetComponent<Animation>();
                if (vrma == null || player == null) throw new InvalidDataException("The file is not a valid VRM Animation");
                if (vrma.BoxMan != null) vrma.ShowBoxMan(false);
                var bridge = new FilteredVrmAnimation(vrma, movement);
                var clipName = string.Empty;
                var duration = 0f;
                var playbackSpeed = NekoAvatarProtocol.NormalizePlaybackSpeed(timeScale);
                foreach (AnimationState state in player)
                {
                    state.wrapMode = loop ? WrapMode.Loop : WrapMode.ClampForever;
                    state.speed = playbackSpeed;
                    if (string.IsNullOrEmpty(clipName))
                    {
                        clipName = state.name;
                        duration = state.length;
                    }
                }
                player.wrapMode = loop ? WrapMode.Loop : WrapMode.ClampForever;
                var playing = string.IsNullOrEmpty(clipName)
                    ? player.Play()
                    : player.Play(clipName);
                var blendDuration = Mathf.Clamp(fadeDuration, 0f, 10f);
                var layer = new AnimationLayer(
                    loadedRoot,
                    bridge,
                    player,
                    immediate || blendDuration <= 0f ? 1f : 0f);
                layer.SetRuntimePaused(_paused);

                InstallAnimationLayer(layer, immediate, blendDuration);
                _animationRoot = loadedRoot;
                _vrma = vrma;
                _animationBridge = bridge;
                _animationPlayer = player;
                _activeAnimationLayer = layer;
                _animationUrl = url;
                _animationActionId = actionId;
                _animationLoop = loop;
                _animationWasPlaying = playing;
                _animationSeekPaused = false;
                _lastAnimationLoop = 0;
                adopted = true;

                RevealAvatarAfterInitialAnimation();
                var body = new ResponseBody
                {
                    url = url,
                    actionId = actionId,
                    playing = playing,
                    duration = duration
                };
                Emit("animation.started", commandId, true, generation, body);
                published = true;
                ClearAnimationPending(commandId);
                DisposeCompletedAnimationLoad();
            }
            catch (OperationCanceledException)
            {
                if (!adopted && loadedRoot != null) DestroyAnimationSource(loadedRoot, loadedRoot.GetComponent<Animation>());
            }
            catch (Exception error)
            {
                if (!adopted && loadedRoot != null) DestroyAnimationSource(loadedRoot, loadedRoot.GetComponent<Animation>());
                if (!published && revision == _animationRevision && generation == _generation)
                {
                    CompleteAnimationFailure(commandId, generation, "animation_import_failed", error.Message);
                }
            }
        }

        private void SetExpression(CommandBody body)
        {
            if (_avatar == null || !TryFindExpression(body.name, out var key)) return;
            if (body.resetOthers)
            {
                foreach (var expressionKey in _avatar.Runtime.Expression.ExpressionKeys)
                {
                    if (!expressionKey.IsMouth && !expressionKey.IsBlink && !expressionKey.IsLookAt)
                    {
                        _avatar.Runtime.Expression.SetWeight(expressionKey, 0f);
                    }
                }
            }
            _avatar.Runtime.Expression.SetWeight(key, NekoAvatarProtocol.Clamp01(body.value));
        }

        private void ResetExpressions()
        {
            if (_avatar == null) return;
            foreach (var key in _avatar.Runtime.Expression.ExpressionKeys)
            {
                if (!key.IsMouth && !key.IsBlink && !key.IsLookAt) _avatar.Runtime.Expression.SetWeight(key, 0f);
            }
        }

        private void SetPose(CommandEnvelope envelope)
        {
            if (_avatar == null)
            {
                EmitError(envelope.id, envelope.generation, "model_not_loaded", "No VRM model is loaded");
                return;
            }
            var poseId = (envelope.body.poseId ?? string.Empty).Trim();
            if (string.IsNullOrEmpty(poseId))
            {
                EmitError(envelope.id, envelope.generation, "invalid_pose_id", "pose.set requires poseId");
                return;
            }
            if (!string.IsNullOrEmpty(_activePoseId) && _activePoseId != poseId && !envelope.body.reset)
            {
                EmitError(envelope.id, envelope.generation, "pose_owner_conflict", "Another poseId owns the active pose");
                return;
            }

            var resolved = new List<PoseBoneState>();
            foreach (var requested in envelope.body.bones ?? Array.Empty<PoseBoneBody>())
            {
                if (requested == null || !NekoAvatarProtocol.TryParseHumanBoneName(requested.name, out var bone) ||
                    !_avatar.TryGetBoneTransform(bone, out var node))
                {
                    EmitError(envelope.id, envelope.generation, "bone_not_found", "Humanoid bone is unavailable: " + requested?.name);
                    return;
                }
                if (!_avatar.DefaultTransformStates.TryGetValue(node, out var rest))
                {
                    EmitError(envelope.id, envelope.generation, "rest_pose_unavailable", "Rest pose is unavailable: " + requested.name);
                    return;
                }
                var euler = ToVector3(requested.eulerRadians, Vector3.zero);
                if (!NekoAvatarProtocol.IsFiniteVector(euler))
                {
                    EmitError(envelope.id, envelope.generation, "invalid_pose", "Pose Euler values must be finite");
                    return;
                }
                resolved.Add(new PoseBoneState
                {
                    Transform = node,
                    RestRotation = rest.LocalRotation,
                    DeltaRotation = Quaternion.Euler(euler * Mathf.Rad2Deg * NekoAvatarProtocol.Clamp01(requested.weight))
                });
            }
            var rootOffset = ToVector3(envelope.body.rootOffset, Vector3.zero);
            if (!NekoAvatarProtocol.IsFiniteVector(rootOffset))
            {
                EmitError(envelope.id, envelope.generation, "invalid_pose", "Pose rootOffset must be finite");
                return;
            }

            RestoreActivePoseToRest();
            _activePoseId = poseId;
            _poseRootOffset = rootOffset;
            _avatar.transform.position += _poseRootOffset;
            _activePoseBones.AddRange(resolved);
            ReplyOk(envelope, "pose.applied");
        }

        private void ResetPose(CommandEnvelope envelope)
        {
            var poseId = (envelope.body.poseId ?? string.Empty).Trim();
            if (!string.IsNullOrEmpty(_activePoseId) && _activePoseId != poseId)
            {
                EmitError(envelope.id, envelope.generation, "pose_owner_mismatch", "pose.reset does not own the active pose");
                return;
            }
            ClearPoseState(true);
            ReplyOk(envelope, "pose.reset");
        }

        private void ApplyActivePose()
        {
            if (string.IsNullOrEmpty(_activePoseId) || _avatar == null) return;
            foreach (var state in _activePoseBones)
            {
                if (state.Transform != null) state.Transform.localRotation = state.RestRotation * state.DeltaRotation;
            }
        }

        private void RestoreActivePoseToRest()
        {
            if (_avatar != null && !string.IsNullOrEmpty(_activePoseId))
            {
                // rootOffset is a pose-local contribution. Remove it from the
                // avatar's *current* position so drag, orbit, snap and guided
                // movement performed while the pose is active are preserved.
                _avatar.transform.position -= _poseRootOffset;
            }
            foreach (var state in _activePoseBones)
            {
                if (state.Transform != null) state.Transform.localRotation = state.RestRotation;
            }
            _activePoseBones.Clear();
        }

        private void ClearPoseState(bool restore)
        {
            if (restore) RestoreActivePoseToRest();
            else _activePoseBones.Clear();
            _activePoseId = null;
            _poseRootOffset = Vector3.zero;
        }

        private void AttachAccessory(CommandEnvelope envelope)
        {
            if (_avatar == null)
            {
                EmitError(envelope.id, envelope.generation, "model_not_loaded", "No VRM model is loaded");
                return;
            }
            var id = GetAccessoryId(envelope.body);
            if (string.IsNullOrEmpty(id))
            {
                EmitError(envelope.id, envelope.generation, "invalid_accessory_id", "accessory.attach requires id");
                return;
            }
            if (!NekoAvatarAccessoryFactory.IsSupportedPreset(envelope.body.preset))
            {
                EmitError(envelope.id, envelope.generation, "unsupported_accessory_preset", "Unsupported accessory preset: " + envelope.body.preset);
                return;
            }
            if (!NekoAvatarProtocol.TryParseHumanBoneName(envelope.body.bone, out var bone) ||
                !_avatar.TryGetBoneTransform(bone, out var boneTransform))
            {
                EmitError(envelope.id, envelope.generation, "bone_not_found", "Humanoid bone is unavailable: " + envelope.body.bone);
                return;
            }
            var position = ToVector3(envelope.body.position, Vector3.zero);
            var euler = ToVector3(envelope.body.eulerRadians, Vector3.zero);
            var scale = ToVector3(envelope.body.scale, Vector3.one);
            if (!NekoAvatarProtocol.IsFiniteVector(position) || !NekoAvatarProtocol.IsFiniteVector(euler) ||
                !NekoAvatarProtocol.IsFiniteVector(scale) || scale.x <= 0f || scale.y <= 0f || scale.z <= 0f)
            {
                EmitError(envelope.id, envelope.generation, "invalid_accessory_transform", "Accessory transform must be finite and scale must be positive");
                return;
            }
            foreach (var anchor in envelope.body.anchors ?? Array.Empty<AccessoryAnchorBody>())
            {
                if (anchor == null || string.IsNullOrWhiteSpace(anchor.name) ||
                    !NekoAvatarProtocol.IsFiniteVector(ToVector3(anchor.localPosition, Vector3.zero)))
                {
                    EmitError(envelope.id, envelope.generation, "invalid_accessory_anchor", "Accessory anchors require a name and finite localPosition");
                    return;
                }
            }

            NekoAvatarAccessoryResource created;
            try
            {
                created = NekoAvatarAccessoryFactory.Create(id, envelope.body.preset);
                created.Root.transform.SetParent(boneTransform, false);
                created.Root.transform.localPosition = position;
                created.Root.transform.localRotation = Quaternion.Euler(euler * Mathf.Rad2Deg);
                created.Root.transform.localScale = scale;
                foreach (var requested in envelope.body.anchors ?? Array.Empty<AccessoryAnchorBody>())
                {
                    var localPosition = ToVector3(requested.localPosition, Vector3.zero);
                    if (created.Anchors.TryGetValue(requested.name, out var existing)) existing.localPosition = localPosition;
                    else NekoAvatarAccessoryFactory.AddAnchor(created, requested.name, localPosition);
                }
            }
            catch (Exception error)
            {
                EmitError(envelope.id, envelope.generation, "accessory_create_failed", error.Message);
                return;
            }

            RemoveAccessory(id);
            _accessories.Add(id, created);
            foreach (var renderer in created.Root.GetComponentsInChildren<Renderer>(true))
            {
                if (_awaitingInitialAnimation)
                {
                    renderer.forceRenderingOff = true;
                    if (!_initiallyHiddenRenderers.Contains(renderer)) _initiallyHiddenRenderers.Add(renderer);
                }
                if (!_modelVisible)
                {
                    renderer.forceRenderingOff = true;
                    if (!_modelVisibilityHiddenRenderers.Contains(renderer)) _modelVisibilityHiddenRenderers.Add(renderer);
                }
            }
            ReplyOk(envelope, "accessory.attached", new ResponseBody { id = id });
        }

        private void SetAccessoryVisible(CommandEnvelope envelope)
        {
            var id = GetAccessoryId(envelope.body);
            if (!_accessories.TryGetValue(id, out var accessory) || accessory.Root == null)
            {
                EmitError(envelope.id, envelope.generation, "accessory_not_found", "Accessory is unavailable: " + id);
                return;
            }
            accessory.Root.SetActive(envelope.body.visible);
            ReplyOk(envelope, "accessory.visibility", new ResponseBody { id = id });
        }

        private void DetachAccessory(CommandEnvelope envelope)
        {
            var id = GetAccessoryId(envelope.body);
            if (!_accessories.ContainsKey(id))
            {
                EmitError(envelope.id, envelope.generation, "accessory_not_found", "Accessory is unavailable: " + id);
                return;
            }
            RemoveAccessory(id);
            ReplyOk(envelope, "accessory.detached", new ResponseBody { id = id });
        }

        private void TrackAnchors(CommandEnvelope envelope)
        {
            if (_avatar == null)
            {
                EmitError(envelope.id, envelope.generation, "model_not_loaded", "No VRM model is loaded");
                return;
            }
            var resolved = new List<AnchorTrackState>();
            var names = new HashSet<string>(StringComparer.Ordinal);
            foreach (var requested in envelope.body.tracks ?? Array.Empty<AnchorTrackBody>())
            {
                if (requested == null || string.IsNullOrWhiteSpace(requested.name) || !names.Add(requested.name))
                {
                    EmitError(envelope.id, envelope.generation, "invalid_anchor_track", "Tracked anchors require unique names");
                    return;
                }
                var localPosition = ToVector3(requested.localPosition, Vector3.zero);
                if (!NekoAvatarProtocol.IsFiniteVector(localPosition))
                {
                    EmitError(envelope.id, envelope.generation, "invalid_anchor_track", "Tracked anchor localPosition must be finite");
                    return;
                }

                Transform target;
                GameObject visibilityRoot;
                if (!string.IsNullOrWhiteSpace(requested.bone))
                {
                    if (!NekoAvatarProtocol.TryParseHumanBoneName(requested.bone, out var bone) ||
                        !_avatar.TryGetBoneTransform(bone, out target))
                    {
                        EmitError(envelope.id, envelope.generation, "bone_not_found", "Humanoid bone is unavailable: " + requested.bone);
                        return;
                    }
                    visibilityRoot = _avatar.gameObject;
                }
                else if (!string.IsNullOrWhiteSpace(requested.accessoryId) &&
                         _accessories.TryGetValue(requested.accessoryId, out var accessory) &&
                         accessory.Root != null)
                {
                    if (string.IsNullOrWhiteSpace(requested.anchor)) target = accessory.Root.transform;
                    else if (!accessory.Anchors.TryGetValue(requested.anchor, out target))
                    {
                        EmitError(envelope.id, envelope.generation, "anchor_not_found", "Accessory anchor is unavailable: " + requested.anchor);
                        return;
                    }
                    visibilityRoot = accessory.Root;
                }
                else
                {
                    EmitError(envelope.id, envelope.generation, "anchor_source_not_found", "Tracked anchor requires an available bone or accessoryId");
                    return;
                }
                resolved.Add(new AnchorTrackState
                {
                    Name = requested.name,
                    Target = target,
                    LocalPosition = localPosition,
                    VisibilityRoot = visibilityRoot
                });
            }

            _anchorTracks.Clear();
            _anchorTracks.AddRange(resolved);
            ReplyOk(envelope, "anchor.tracked", new ResponseBody { tracked = resolved.Count });
        }

        private void EmitTrackedAnchors()
        {
            if (_anchorTracks.Count == 0 || _camera == null) return;
            var projected = new AnchorScreenBody[_anchorTracks.Count];
            for (var index = 0; index < _anchorTracks.Count; ++index)
            {
                var track = _anchorTracks[index];
                var point = new AnchorScreenBody { name = track.Name };
                if (track.Target != null)
                {
                    var viewport = _camera.WorldToViewportPoint(track.Target.TransformPoint(track.LocalPosition));
                    point.x = viewport.x * _surfaceWidth;
                    point.y = (1f - viewport.y) * _surfaceHeight;
                    point.behindCamera = viewport.z <= 0f;
                    point.visible = !point.behindCamera && _modelVisible && !_awaitingInitialAnimation &&
                        track.Target.gameObject.activeInHierarchy && track.VisibilityRoot != null &&
                        track.VisibilityRoot.activeInHierarchy && viewport.x >= 0f && viewport.x <= 1f &&
                        viewport.y >= 0f && viewport.y <= 1f;
                }
                else
                {
                    point.behindCamera = true;
                    point.visible = false;
                }
                projected[index] = point;
            }
            Emit("anchor.screen", generation: _generation, body: new ResponseBody
            {
                anchors = projected,
                width = _surfaceWidth,
                height = _surfaceHeight,
                tracked = projected.Length
            });
        }

        private static string GetAccessoryId(CommandBody body)
        {
            return ((string.IsNullOrWhiteSpace(body.accessoryId) ? body.id : body.accessoryId) ?? string.Empty).Trim();
        }

        private void RemoveAccessory(string id)
        {
            if (!_accessories.TryGetValue(id, out var accessory)) return;
            _anchorTracks.RemoveAll(track => track.VisibilityRoot == accessory.Root);
            foreach (var renderer in accessory.Root.GetComponentsInChildren<Renderer>(true))
            {
                _initiallyHiddenRenderers.Remove(renderer);
                _modelVisibilityHiddenRenderers.Remove(renderer);
            }
            _accessories.Remove(id);
            accessory.Release();
        }

        private void ClearAccessories()
        {
            foreach (var accessory in _accessories.Values) accessory.Release();
            _accessories.Clear();
            _anchorTracks.Clear();
        }

        private void SetExpressionWeights(CommandBody body)
        {
            if (_avatar == null || body.weights == null) return;
            _expressionWeights.Clear();
            foreach (var entry in body.weights)
            {
                if (entry == null || !TryFindExpression(entry.name, out var key)) continue;
                _expressionWeights[key] = NekoAvatarProtocol.Clamp01(entry.value);
            }
            _avatar.Runtime.Expression.SetWeightsNonAlloc(_expressionWeights);
        }

        private void SetViseme(CommandBody body)
        {
            var name = NekoAvatarProtocol.NormalizeExpressionName(body.name);
            if (name == "aa")
            {
                if (_weightedVisemesActive)
                {
                    ClearVisemeWeights();
                    _mouth = 0f;
                }
                _weightedVisemesActive = false;
                _targetMouth = NekoAvatarProtocol.Clamp01(body.value);
                return;
            }
            if (_avatar != null && TryFindExpression(name, out var key))
            {
                _avatar.Runtime.Expression.SetWeight(key, NekoAvatarProtocol.Clamp01(body.value));
            }
        }

        private void SetVisemeWeights(CommandBody body)
        {
            _weightedVisemesActive = true;
            _visemeWeights[ExpressionKey.Aa] = NekoAvatarProtocol.Clamp01(body.aa);
            _visemeWeights[ExpressionKey.Ih] = NekoAvatarProtocol.Clamp01(body.ih);
            _visemeWeights[ExpressionKey.Ou] = NekoAvatarProtocol.Clamp01(body.ou);
            _visemeWeights[ExpressionKey.Ee] = NekoAvatarProtocol.Clamp01(body.ee);
            _visemeWeights[ExpressionKey.Oh] = NekoAvatarProtocol.Clamp01(body.oh);
            if (_avatar != null) _avatar.Runtime.Expression.SetWeightsNonAlloc(_visemeWeights);
        }

        private void ClearVisemeWeights()
        {
            _visemeWeights[ExpressionKey.Aa] = 0f;
            _visemeWeights[ExpressionKey.Ih] = 0f;
            _visemeWeights[ExpressionKey.Ou] = 0f;
            _visemeWeights[ExpressionKey.Ee] = 0f;
            _visemeWeights[ExpressionKey.Oh] = 0f;
            if (_avatar != null) _avatar.Runtime.Expression.SetWeightsNonAlloc(_visemeWeights);
        }

        private void ApplyLighting(LightingBody lighting)
        {
            if (lighting == null) return;
            RenderSettings.ambientLight = Color.white * Mathf.Clamp(lighting.ambient, 0f, 4f);
            SetLightIntensity(_mainLight, lighting.main);
            SetLightIntensity(_fillLight, lighting.fill);
            SetLightIntensity(_rimLight, lighting.rim);
            SetLightIntensity(_topLight, lighting.top);
            SetLightIntensity(_bottomLight, lighting.bottom);
            if (_toneMapping != null)
            {
                _toneMapping.Configure(lighting.toneMapping, lighting.exposure);
            }
            ApplyOutlineWidthScale(lighting.outlineWidthScale);
        }

        private void ApplyOutlineWidthScale(float scale)
        {
            _outlineWidthScale = float.IsNaN(scale) || float.IsInfinity(scale)
                ? 1f
                : Mathf.Clamp(scale, 0f, 10f);
            if (_avatar == null) return;
            foreach (var renderer in _avatar.GetComponentsInChildren<Renderer>(true))
            {
                foreach (var material in renderer.sharedMaterials)
                {
                    if (material == null || !material.HasProperty(OutlineWidthProperty)) continue;
                    if (!_outlineWidthBaselines.TryGetValue(material, out var baseline))
                    {
                        baseline = material.GetFloat(OutlineWidthProperty);
                        _outlineWidthBaselines[material] = baseline;
                    }
                    material.SetFloat(
                        OutlineWidthProperty,
                        NekoAvatarProtocol.ScaleOutlineWidth(baseline, _outlineWidthScale));
                }
            }
        }

        private void RemoveOutlineMaterialBaselines(Vrm10Instance avatar)
        {
            if (avatar == null) return;
            foreach (var renderer in avatar.GetComponentsInChildren<Renderer>(true))
            {
                foreach (var material in renderer.sharedMaterials)
                {
                    if (material != null) _outlineWidthBaselines.Remove(material);
                }
            }
        }

        private static void SetLightIntensity(Light light, float value)
        {
            if (light == null) return;
            light.intensity = Mathf.Clamp(value, 0f, 8f);
            light.enabled = light.intensity > 0f;
        }

        private void ApplyQuality(CommandBody body)
        {
            var preset = NekoAvatarProtocol.NormalizeQualityPreset(body.quality);
            switch (preset)
            {
                case "low": QualitySettings.antiAliasing = 0; break;
                case "medium": QualitySettings.antiAliasing = 2; break;
                case "high": QualitySettings.antiAliasing = 4; break;
            }
            if (NekoAvatarProtocol.TryNormalizeTargetFrameRate(body.targetFrameRate, out var targetFrameRate))
            {
                Application.targetFrameRate = targetFrameRate;
            }
            if (body.antiAliasing != 0) QualitySettings.antiAliasing = NormalizeAntiAliasing(body.antiAliasing);
            QualitySettings.pixelLightCount = Mathf.Max(QualitySettings.pixelLightCount, 5);
            _mainLight.shadows = body.shadows ? LightShadows.Soft : LightShadows.None;
        }

        private void SetPaused(bool value)
        {
            _paused = value;
            _camera.enabled = !value;
            if (_avatar != null) _avatar.UpdateType = value ? Vrm10Instance.UpdateTypes.None : Vrm10Instance.UpdateTypes.LateUpdate;
            UpdateAnimationPlayerPauseStates();
        }

        private void ResizeSurface(CommandBody body)
        {
            ++_snapRevision;
            _surfaceWidth = Mathf.Max(1f, body.width);
            _surfaceHeight = Mathf.Max(1f, body.height);
            _camera.aspect = Mathf.Max(0.1f, _surfaceWidth / _surfaceHeight);
            if (_avatar != null)
            {
                StartCoroutine(EmitBoundsAfterStableFrame(_modelRevision, _generation));
            }
        }

        private IEnumerator ReplyAfterEndOfFrame(CommandEnvelope envelope)
        {
            yield return new WaitForEndOfFrame();
            ReplyOk(envelope, "surface.synced", new ResponseBody
            {
                width = _surfaceWidth,
                height = _surfaceHeight,
                bounds = _avatar != null ? CalculateScreenBounds() : null
            });
        }

        private void ApplyModelFit(CommandEnvelope envelope)
        {
            if (_avatar == null || !TryGetFitReferenceBounds(out var bounds))
            {
                EmitError(envelope.id, envelope.generation, "model_not_loaded", "No VRM model is available to fit");
                return;
            }

            CancelOrbit();
            CancelGuidedMovement();
            ++_snapRevision;

            if (envelope.body.width > 0f) _surfaceWidth = Mathf.Max(1f, envelope.body.width);
            if (envelope.body.height > 0f) _surfaceHeight = Mathf.Max(1f, envelope.body.height);
            _camera.aspect = Mathf.Max(0.1f, _surfaceWidth / Mathf.Max(1f, _surfaceHeight));
            GetCameraPlaneBounds(bounds, out var minU, out var maxU, out var minV, out var maxV);
            var sourceWidth = Mathf.Max(0.0001f, maxU - minU);
            var sourceHeight = Mathf.Max(0.0001f, maxV - minV);
            var padding = Mathf.Max(0f, envelope.body.padding);
            var availableWidth = Mathf.Max(1f, _surfaceWidth - padding * 2f);
            var availableHeight = Mathf.Max(1f, _surfaceHeight - padding * 2f);
            var pixelsPerUnit = NekoAvatarProtocol.CalculateFitPixelsPerUnit(
                envelope.body.mode,
                availableWidth,
                availableHeight,
                sourceWidth,
                sourceHeight,
                _nativeFitPixelsPerUnit,
                envelope.body.scaleMultiplier,
                envelope.body.autoScale,
                envelope.body.minWidth,
                envelope.body.minHeight);
            var viewScale = envelope.body.viewScale > 0f ? envelope.body.viewScale : 100f;
            pixelsPerUnit *= Mathf.Clamp(viewScale, 0.5f, 5000f) / 100f;
            _camera.orthographicSize = Mathf.Max(0.0001f, _surfaceHeight / (pixelsPerUnit * 2f));

            var visibleHeight = _camera.orthographicSize * 2f;
            var visibleWidth = visibleHeight * _camera.aspect;
            var paddingWorld = padding / pixelsPerUnit;
            ParseAlignment(envelope.body.align, out var vertical, out var horizontal);
            var targetU = (minU + maxU) * 0.5f;
            if (horizontal == "left") targetU = minU + visibleWidth * 0.5f - paddingWorld;
            else if (horizontal == "right") targetU = maxU - visibleWidth * 0.5f + paddingWorld;
            var targetV = (minV + maxV) * 0.5f;
            if (vertical == "bottom") targetV = minV + visibleHeight * 0.5f - paddingWorld;
            else if (vertical == "top") targetV = maxV - visibleHeight * 0.5f + paddingWorld;
            targetU -= _surfaceWidth * Mathf.Clamp(envelope.body.viewX, -5000f, 5000f) / 100f / pixelsPerUnit;
            targetV += _surfaceHeight * Mathf.Clamp(envelope.body.viewY, -5000f, 5000f) / 100f / pixelsPerUnit;

            var cameraPosition = _camera.transform.position;
            var currentU = Vector3.Dot(cameraPosition, _camera.transform.right);
            var currentV = Vector3.Dot(cameraPosition, _camera.transform.up);
            _camera.transform.position +=
                _camera.transform.right * (targetU - currentU) +
                _camera.transform.up * (targetV - currentV);
            UpdateCameraClipPlanes(bounds);

            var immediateBounds = CalculateScreenBounds();
            var body = new ResponseBody
            {
                transform = BuildAvatarTransform(),
                bounds = immediateBounds
            };
            ReplyOk(envelope, "model.fit", body);
            if (immediateBounds != null)
            {
                Emit("model.bounds", generation: _generation, body: new ResponseBody
                {
                    url = _modelUrl,
                    bounds = immediateBounds
                });
            }
            StartCoroutine(EmitBoundsAfterStableFrame(_modelRevision, _generation));
        }

        private void GetCameraPlaneBounds(Bounds bounds, out float minU, out float maxU, out float minV, out float maxV)
        {
            minU = float.PositiveInfinity;
            maxU = float.NegativeInfinity;
            minV = float.PositiveInfinity;
            maxV = float.NegativeInfinity;
            var min = bounds.min;
            var max = bounds.max;
            for (var x = 0; x < 2; ++x)
            for (var y = 0; y < 2; ++y)
            for (var z = 0; z < 2; ++z)
            {
                var point = new Vector3(x == 0 ? min.x : max.x, y == 0 ? min.y : max.y, z == 0 ? min.z : max.z);
                var u = Vector3.Dot(point, _camera.transform.right);
                var v = Vector3.Dot(point, _camera.transform.up);
                minU = Mathf.Min(minU, u);
                maxU = Mathf.Max(maxU, u);
                minV = Mathf.Min(minV, v);
                maxV = Mathf.Max(maxV, v);
            }
        }

        private static void ParseAlignment(string value, out string vertical, out string horizontal)
        {
            var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
            if (normalized == "center")
            {
                vertical = "center";
                horizontal = "center";
                return;
            }
            var parts = normalized.Split('-');
            vertical = parts.Length == 2 && (parts[0] == "top" || parts[0] == "bottom") ? parts[0] : "center";
            horizontal = parts.Length == 2 && (parts[1] == "left" || parts[1] == "right") ? parts[1] : "center";
        }

        private void ClearSurface()
        {
            if (_camera == null) return;
            var wasEnabled = _camera.enabled;
            var cullingMask = _camera.cullingMask;
            try
            {
                _camera.enabled = true;
                _camera.cullingMask = 0;
                _camera.Render();
            }
            finally
            {
                _camera.cullingMask = cullingMask;
                _camera.enabled = wasEnabled;
            }
        }

        private void SetLookAtEnabled(bool value)
        {
            _lookAtEnabled = value;
            if (_avatar != null) _avatar.LookAtTarget = value ? _lookAtTarget : null;
        }

        private void ApplyPointerLookAt(CommandBody body)
        {
            if (_avatar == null || !_lookAtEnabled || _camera == null) return;
            var viewportX = NekoAvatarProtocol.Clamp01(body.x / Mathf.Max(1f, _surfaceWidth));
            var viewportY = 1f - NekoAvatarProtocol.Clamp01(body.y / Mathf.Max(1f, _surfaceHeight));
            var depth = Mathf.Max(2f, Vector3.Distance(_camera.transform.position, _avatar.transform.position));
            _lookAtTarget.position = _camera.ViewportToWorldPoint(new Vector3(viewportX, viewportY, depth));
        }

        private void ApplyModelTransform(CommandBody body)
        {
            if (_avatar == null) return;
            CancelOrbit();
            CancelGuidedMovement();
            ++_snapRevision;
            if (body.position != null)
            {
                var logicalPosition = GetAvatarModelPosition();
                SetAvatarModelPosition(ToVector3(body.position, logicalPosition));
            }
            if (body.rotation != null)
            {
                _avatar.transform.eulerAngles = ToVector3(body.rotation, Vector3.zero) * Mathf.Rad2Deg;
            }
            if (body.scale != null)
            {
                var scale = ToVector3(body.scale, _avatar.transform.localScale);
                scale.x = Mathf.Clamp(scale.x, MinModelScale, MaxModelScale);
                scale.y = Mathf.Clamp(scale.y, MinModelScale, MaxModelScale);
                scale.z = Mathf.Clamp(scale.z, MinModelScale, MaxModelScale);
                _avatar.transform.localScale = scale;
            }
            StartCoroutine(EmitBoundsAfterStableFrame(_modelRevision, _generation));
        }

        private void DragModel(CommandBody body)
        {
            if (_avatar == null || _interactionLocked) return;
            CancelOrbit();
            CancelGuidedMovement();
            ++_snapRevision;
            var height = Mathf.Max(1f, body.height > 0f ? body.height : _surfaceHeight);
            var worldPerPixel = _camera.orthographicSize * 2f / height;
            _avatar.transform.position += new Vector3(body.dx * worldPerPixel, -body.dy * worldPerPixel, 0f);
            if (body.clamp) ClampAvatarToSurface(body.minVisiblePixels);
            StartCoroutine(EmitBoundsAfterStableFrame(_modelRevision, _generation));
        }

        private void HandleModelOrbit(CommandEnvelope envelope)
        {
            var phase = (envelope.body.phase ?? string.Empty).Trim().ToLowerInvariant();
            switch (phase)
            {
                case "start": BeginModelOrbit(envelope); return;
                case "update": UpdateModelOrbit(envelope); return;
                case "end":
                case "cancel": EndModelOrbit(envelope, phase); return;
                default:
                    EmitError(envelope.id, envelope.generation, "invalid_orbit_phase", "model.orbit requires start, update, end, or cancel");
                    return;
            }
        }

        private void BeginModelOrbit(CommandEnvelope envelope)
        {
            if (_avatar == null || !TryGetAvatarBounds(out var bounds))
            {
                EmitError(envelope.id, envelope.generation, "model_not_loaded", "No VRM model is available to orbit");
                return;
            }
            if (envelope.generation != _generation)
            {
                EmitError(envelope.id, envelope.generation, "stale_generation", "Orbit targets an inactive model generation");
                return;
            }
            if (_interactionLocked)
            {
                EmitError(envelope.id, envelope.generation, "interaction_locked", "Model interaction is locked");
                return;
            }
            var interactionId = (envelope.body.interactionId ?? string.Empty).Trim();
            if (string.IsNullOrEmpty(interactionId))
            {
                EmitError(envelope.id, envelope.generation, "invalid_interaction_id", "model.orbit requires interactionId");
                return;
            }

            CancelGuidedMovement();
            ++_snapRevision;
            _orbit = new OrbitState
            {
                Avatar = _avatar,
                ModelRevision = _modelRevision,
                Generation = envelope.generation,
                InteractionId = interactionId,
                Pivot = bounds.center,
                StartPosition = _avatar.transform.position,
                StartRotation = _avatar.transform.rotation,
                StartX = envelope.body.x,
                StartY = envelope.body.y
            };
            ReplyOk(envelope, "model.orbitStarted", new ResponseBody
            {
                moved = false,
                transform = BuildAvatarTransform(),
                bounds = CalculateScreenBounds()
            });
        }

        private bool TryGetCurrentOrbit(CommandEnvelope envelope, out OrbitState orbit)
        {
            orbit = _orbit;
            return orbit != null && orbit.Avatar != null && orbit.Avatar == _avatar &&
                orbit.ModelRevision == _modelRevision && orbit.Generation == envelope.generation &&
                orbit.Generation == _generation &&
                orbit.InteractionId == (envelope.body.interactionId ?? string.Empty).Trim();
        }

        private void UpdateModelOrbit(CommandEnvelope envelope)
        {
            if (!TryGetCurrentOrbit(envelope, out var orbit))
            {
                EmitError(envelope.id, envelope.generation, "orbit_not_started", "model.orbit update requires the current interactionId");
                return;
            }
            if (_interactionLocked)
            {
                CancelOrbit();
                EmitError(envelope.id, envelope.generation, "interaction_locked", "Model interaction is locked");
                return;
            }

            var totalX = envelope.body.x - orbit.StartX;
            var totalY = envelope.body.y - orbit.StartY;
            var delta = NekoAvatarProtocol.CalculateOrbitDelta(totalX, totalY);
            orbit.Avatar.transform.position = orbit.Pivot + delta * (orbit.StartPosition - orbit.Pivot);
            orbit.Avatar.transform.rotation = delta * orbit.StartRotation;
            orbit.Moved = orbit.Moved || Mathf.Abs(totalX) > 0.001f || Mathf.Abs(totalY) > 0.001f;
            StartCoroutine(EmitBoundsAfterStableFrame(_modelRevision, _generation));
            ReplyOk(envelope, "model.orbitUpdated", new ResponseBody
            {
                moved = orbit.Moved,
                transform = BuildAvatarTransform(),
                bounds = CalculateScreenBounds()
            });
        }

        private void EndModelOrbit(CommandEnvelope envelope, string phase)
        {
            if (!TryGetCurrentOrbit(envelope, out var orbit))
            {
                EmitError(envelope.id, envelope.generation, "orbit_not_started", "model.orbit end requires the current interactionId");
                return;
            }
            _orbit = null;
            var bounds = CalculateScreenBounds();
            ReplyOk(envelope, phase == "cancel" ? "model.orbitCancelled" : "model.orbitEnded", new ResponseBody
            {
                moved = orbit.Moved,
                transform = BuildAvatarTransform(),
                bounds = bounds
            });
            if (bounds != null)
            {
                Emit("model.bounds", generation: _generation, body: new ResponseBody
                {
                    url = _modelUrl,
                    bounds = bounds
                });
            }
        }

        private void CancelOrbit()
        {
            _orbit = null;
        }

        private void BeginGuidedMovement(CommandEnvelope envelope)
        {
            if (_avatar == null || _camera == null)
            {
                EmitError(envelope.id, envelope.generation, "model_not_loaded", "No VRM model is available to move");
                return;
            }
            if (envelope.generation != _generation)
            {
                EmitError(envelope.id, envelope.generation, "stale_generation", "Guided movement targets an inactive model generation");
                return;
            }
            if (_interactionLocked)
            {
                EmitError(envelope.id, envelope.generation, "interaction_locked", "Model interaction is locked");
                return;
            }

            var actionId = (envelope.body.actionId ?? string.Empty).Trim();
            if (string.IsNullOrEmpty(actionId))
            {
                EmitError(envelope.id, envelope.generation, "invalid_action_id", "model.moveToScreen requires actionId");
                return;
            }
            var acceleration = NekoAvatarProtocol.NormalizePositiveMovementValue(
                envelope.body.acceleration,
                MovementAcceleration);
            var deceleration = NekoAvatarProtocol.NormalizePositiveMovementValue(
                envelope.body.deceleration,
                MovementDeceleration);
            var arrivalThreshold = NekoAvatarProtocol.NormalizePositiveMovementValue(
                envelope.body.arrival,
                MovementArrivalThreshold);
            var minVisiblePixels = NekoAvatarProtocol.NormalizeMinVisiblePixels(
                envelope.body.minVisiblePixels);
            if (!TryScreenPointToAvatarPlane(envelope.body.x, envelope.body.y, out var projectedTarget) ||
                !TryCalculateClampedAvatarPosition(
                    projectedTarget,
                    minVisiblePixels,
                    out var target))
            {
                EmitError(envelope.id, envelope.generation, "invalid_screen_target", "Screen target cannot be projected onto the avatar plane");
                return;
            }

            var restYaw = _guidedMovement != null && _guidedMovement.Avatar == _avatar
                ? _guidedMovement.RestYaw
                : NekoAvatarProtocol.GetWorldYaw(_avatar.transform.rotation);
            CancelOrbit();
            CancelGuidedMovement();
            ++_snapRevision;

            var maxSpeed = NekoAvatarProtocol.NormalizeMovementMaxSpeed(envelope.body.maxSpeed);
            var distance = Vector3.Distance(_avatar.transform.position, target);
            if (maxSpeed <= 0f)
            {
                ReplyGuidedMovementResult(envelope, actionId, false, "model.moveCompleted", false);
                return;
            }
            if (distance <= arrivalThreshold)
            {
                _guidedMovement = new GuidedMovementState
                {
                    Envelope = envelope,
                    Avatar = _avatar,
                    ModelRevision = _modelRevision,
                    ActionId = actionId,
                    Target = target,
                    RestYaw = restYaw,
                    MaxSpeed = maxSpeed,
                    Acceleration = acceleration,
                    Deceleration = deceleration,
                    ArrivalThreshold = arrivalThreshold,
                    MinVisiblePixels = minVisiblePixels,
                    Moved = false,
                    NextBoundsAt = Time.unscaledTime + MovementBoundsIntervalSeconds
                };
                BeginMovementYawRestore(_guidedMovement);
                return;
            }

            _guidedMovement = new GuidedMovementState
            {
                Envelope = envelope,
                Avatar = _avatar,
                ModelRevision = _modelRevision,
                ActionId = actionId,
                Target = target,
                RestYaw = restYaw,
                MaxSpeed = maxSpeed,
                Acceleration = acceleration,
                Deceleration = deceleration,
                ArrivalThreshold = arrivalThreshold,
                MinVisiblePixels = minVisiblePixels,
                NextBoundsAt = Time.unscaledTime + MovementBoundsIntervalSeconds
            };
        }

        private void CancelGuidedMovementCommand(CommandEnvelope envelope)
        {
            if (envelope.generation != _generation)
            {
                EmitError(envelope.id, envelope.generation, "stale_generation", "Guided movement cancellation targets an inactive model generation");
                return;
            }
            var actionId = (envelope.body.actionId ?? string.Empty).Trim();
            if (string.IsNullOrEmpty(actionId))
            {
                EmitError(envelope.id, envelope.generation, "invalid_action_id", "model.moveCancel requires actionId");
                return;
            }

            var interrupted = _guidedMovement;
            var cancelled = CancelGuidedMovement(actionId);
            ReplyOk(envelope, cancelled ? "model.moveCancelled" : "model.moveCancelIgnored", new ResponseBody
            {
                actionId = actionId,
                moved = cancelled && interrupted != null && interrupted.Moved,
                transform = _avatar != null ? BuildAvatarTransform() : null,
                bounds = _avatar != null ? CalculateScreenBounds() : null
            });
        }

        private bool CancelGuidedMovement(string actionId = null)
        {
            var state = _guidedMovement;
            if (state == null ||
                (!string.IsNullOrEmpty(actionId) && state.ActionId != actionId))
            {
                return false;
            }

            _guidedMovement = null;
            ReplyGuidedMovementResult(
                state.Envelope,
                state.ActionId,
                state.Moved,
                "model.moveCancelled",
                false);
            return true;
        }

        private void UpdateGuidedMovement(float deltaTime)
        {
            var state = _guidedMovement;
            if (state == null) return;
            if (state.Avatar == null || state.Avatar != _avatar ||
                state.ModelRevision != _modelRevision ||
                state.Envelope.generation != _generation)
            {
                CancelGuidedMovement();
                return;
            }

            var dt = Mathf.Max(0f, deltaTime);
            if (state.RestoringYaw)
            {
                if (dt <= 0f) return;
                state.RestoreElapsed += dt;
                var progress = Mathf.Clamp01(state.RestoreElapsed / MovementRestoreYawSeconds);
                var eased = progress * progress * (3f - 2f * progress);
                SetAvatarWorldYaw(state.Avatar, state.RestoreStartYaw + state.RestoreDeltaYaw * eased);
                MaybeEmitGuidedMovementBounds(state);
                if (progress < 1f) return;

                SetAvatarWorldYaw(state.Avatar, state.RestYaw);
                CompleteGuidedMovement(state);
                return;
            }

            var offset = state.Target - state.Avatar.transform.position;
            var distance = offset.magnitude;
            if (float.IsNaN(distance) || float.IsInfinity(distance))
            {
                CancelGuidedMovement();
                return;
            }
            if (distance <= state.ArrivalThreshold)
            {
                if (TryCalculateClampedAvatarPosition(
                        state.Target,
                        state.MinVisiblePixels,
                        out var revalidatedTarget))
                {
                    state.Target = revalidatedTarget;
                }
                offset = state.Target - state.Avatar.transform.position;
                distance = offset.magnitude;
                if (float.IsNaN(distance) || float.IsInfinity(distance))
                {
                    CancelGuidedMovement();
                    return;
                }
                if (distance <= state.ArrivalThreshold)
                {
                    if (distance > 0.000001f)
                    {
                        state.Avatar.transform.position = state.Target;
                        state.Moved = true;
                    }
                    state.Velocity = 0f;
                    BeginMovementYawRestore(state);
                    return;
                }
            }
            if (dt <= 0f) return;

            state.Velocity = NekoAvatarProtocol.CalculateMovementVelocity(
                state.Velocity,
                distance,
                dt,
                state.MaxSpeed,
                state.Acceleration,
                state.Deceleration,
                state.ArrivalThreshold);
            var step = Mathf.Min(distance, state.Velocity * dt);
            if (step <= 0f) return;

            var direction = offset / distance;
            if (TryCalculateMovementYaw(direction, out var targetYaw))
            {
                var currentYaw = NekoAvatarProtocol.GetWorldYaw(state.Avatar.transform.rotation);
                var yawDelta = NekoAvatarProtocol.ShortestAngleDelta(currentYaw, targetYaw);
                var turn = yawDelta * Mathf.Min(1f, dt * 10f);
                RotateAvatarWorldYaw(state.Avatar, turn);
                if (Mathf.Abs(yawDelta - turn) > Mathf.PI / 12f)
                {
                    state.Velocity = 0f;
                    MaybeEmitGuidedMovementBounds(state);
                    return;
                }
            }

            state.Avatar.transform.position += direction * step;
            state.Moved = true;
            MaybeEmitGuidedMovementBounds(state);
        }

        private void BeginMovementYawRestore(GuidedMovementState state)
        {
            if (state == null || state != _guidedMovement || state.Avatar == null) return;
            EmitGuidedMovementArrival(state);
            state.RestoreStartYaw = NekoAvatarProtocol.GetWorldYaw(state.Avatar.transform.rotation);
            state.RestoreDeltaYaw = NekoAvatarProtocol.ShortestAngleDelta(
                state.RestoreStartYaw,
                state.RestYaw);
            state.RestoreElapsed = 0f;
            state.RestoringYaw = true;
            if (Mathf.Abs(state.RestoreDeltaYaw) > 0.001f) return;
            SetAvatarWorldYaw(state.Avatar, state.RestYaw);
            CompleteGuidedMovement(state);
        }

        private void EmitGuidedMovementArrival(GuidedMovementState state)
        {
            if (state == null || state.Arrived || state.Avatar == null || state.Avatar != _avatar) return;
            state.Arrived = true;
            Emit("model.moveArrived", generation: _generation, body: new ResponseBody
            {
                actionId = state.ActionId,
                moved = state.Moved,
                transform = BuildAvatarTransform(),
                bounds = CalculateScreenBounds()
            });
        }

        private void CompleteGuidedMovement(GuidedMovementState state)
        {
            if (state == null || state != _guidedMovement) return;
            _guidedMovement = null;
            ReplyGuidedMovementResult(
                state.Envelope,
                state.ActionId,
                state.Moved,
                "model.moveCompleted",
                true);
        }

        private void ReplyGuidedMovementResult(
            CommandEnvelope envelope,
            string actionId,
            bool moved,
            string eventName,
            bool emitBounds)
        {
            var isCurrent = _avatar != null && envelope != null && envelope.generation == _generation;
            var bounds = isCurrent ? CalculateScreenBounds() : null;
            ReplyOk(envelope, eventName, new ResponseBody
            {
                actionId = actionId,
                moved = moved,
                transform = isCurrent ? BuildAvatarTransform() : null,
                bounds = bounds
            });
            if (!emitBounds || !isCurrent || bounds == null) return;
            Emit("model.bounds", generation: _generation, body: new ResponseBody
            {
                url = _modelUrl,
                bounds = bounds
            });
            StartCoroutine(EmitBoundsAfterStableFrame(_modelRevision, _generation));
        }

        private void MaybeEmitGuidedMovementBounds(GuidedMovementState state)
        {
            if (state == null || state != _guidedMovement || Time.unscaledTime < state.NextBoundsAt) return;
            state.NextBoundsAt = Time.unscaledTime + MovementBoundsIntervalSeconds;
            var bounds = CalculateScreenBounds();
            if (bounds == null) return;
            Emit("model.bounds", generation: _generation, body: new ResponseBody
            {
                url = _modelUrl,
                bounds = bounds
            });
        }

        private bool TryScreenPointToAvatarPlane(float x, float y, out Vector3 target)
        {
            target = Vector3.zero;
            if (_avatar == null || _camera == null ||
                float.IsNaN(x) || float.IsInfinity(x) ||
                float.IsNaN(y) || float.IsInfinity(y))
            {
                return false;
            }
            var viewport = new Vector3(
                x / Mathf.Max(1f, _surfaceWidth),
                1f - y / Mathf.Max(1f, _surfaceHeight),
                0f);
            var ray = _camera.ViewportPointToRay(viewport);
            var plane = new Plane(_camera.transform.forward, _avatar.transform.position);
            if (!plane.Raycast(ray, out var distance) || distance < 0f) return false;
            target = ray.GetPoint(distance);
            return NekoAvatarProtocol.IsFiniteVector(target);
        }

        private bool TryCalculateMovementYaw(Vector3 direction, out float yaw)
        {
            yaw = 0f;
            if (_camera == null || !NekoAvatarProtocol.IsFiniteVector(direction)) return false;
            var cameraRight = _camera.transform.right;
            var cameraForward = _camera.transform.forward;
            var screenX = Vector3.Dot(direction, cameraRight);
            var screenY = Vector3.Dot(direction, _camera.transform.up);
            cameraRight.y = 0f;
            cameraForward.y = 0f;
            if (cameraRight.sqrMagnitude <= 0.00000001f || cameraForward.sqrMagnitude <= 0.00000001f)
            {
                return false;
            }
            cameraRight.Normalize();
            cameraForward.Normalize();
            var facing = cameraRight * screenX + cameraForward * screenY;
            if (facing.sqrMagnitude <= 0.00000001f) return false;
            yaw = Mathf.Atan2(facing.x, facing.z);
            return !float.IsNaN(yaw) && !float.IsInfinity(yaw);
        }

        private static void RotateAvatarWorldYaw(Vrm10Instance avatar, float deltaRadians)
        {
            if (avatar == null || Mathf.Approximately(deltaRadians, 0f)) return;
            avatar.transform.rotation = Quaternion.AngleAxis(
                deltaRadians * Mathf.Rad2Deg,
                Vector3.up) * avatar.transform.rotation;
        }

        private static void SetAvatarWorldYaw(Vrm10Instance avatar, float yawRadians)
        {
            if (avatar == null) return;
            var currentYaw = NekoAvatarProtocol.GetWorldYaw(avatar.transform.rotation);
            RotateAvatarWorldYaw(
                avatar,
                NekoAvatarProtocol.ShortestAngleDelta(currentYaw, yawRadians));
        }

        private void SetInteractionLocked(bool locked)
        {
            _interactionLocked = locked;
            if (!locked) return;
            CancelOrbit();
            CancelGuidedMovement();
            ++_snapRevision;
        }

        private void SnapModelIntoScreen(CommandEnvelope envelope)
        {
            if (_avatar == null)
            {
                EmitError(envelope.id, envelope.generation, "model_not_loaded", "No VRM model is loaded");
                return;
            }

            CancelOrbit();
            CancelGuidedMovement();
            var avatar = _avatar;
            var start = avatar.transform.position;
            var modelRevision = _modelRevision;
            var snapRevision = ++_snapRevision;
            if (!TryCalculateClampedAvatarPosition(envelope.body.minVisiblePixels, out var target) ||
                (target - start).sqrMagnitude < 0.00000001f)
            {
                ReplySnapResult(envelope, avatar, false, false);
                return;
            }

            if (!envelope.body.animate)
            {
                avatar.transform.position = target;
                ReplySnapResult(envelope, avatar, true, true);
                return;
            }

            StartCoroutine(AnimateSnap(
                envelope,
                avatar,
                start,
                target,
                modelRevision,
                snapRevision));
        }

        private IEnumerator AnimateSnap(
            CommandEnvelope envelope,
            Vrm10Instance avatar,
            Vector3 start,
            Vector3 target,
            int modelRevision,
            int snapRevision)
        {
            var elapsed = 0f;
            while (elapsed < SnapDurationSeconds)
            {
                yield return null;
                if (avatar == null || avatar != _avatar || modelRevision != _modelRevision ||
                    snapRevision != _snapRevision || envelope.generation != _generation)
                {
                    ReplySnapResult(envelope, avatar, false, false);
                    yield break;
                }
                elapsed += Mathf.Max(0f, Time.unscaledDeltaTime);
                var progress = Mathf.Clamp01(elapsed / SnapDurationSeconds);
                avatar.transform.position = Vector3.LerpUnclamped(
                    start,
                    target,
                    NekoAvatarProtocol.EaseOutBack(progress));
            }

            avatar.transform.position = target;
            ReplySnapResult(envelope, avatar, true, true);
        }

        private void ReplySnapResult(
            CommandEnvelope envelope,
            Vrm10Instance avatar,
            bool moved,
            bool emitBounds)
        {
            var isCurrent = avatar != null && avatar == _avatar && envelope.generation == _generation;
            var bounds = isCurrent ? CalculateScreenBounds() : null;
            ReplyOk(envelope, "model.snapped", new ResponseBody
            {
                moved = moved,
                transform = isCurrent ? BuildAvatarTransform() : null,
                bounds = bounds
            });
            if (!emitBounds || !isCurrent || bounds == null) return;
            Emit("model.bounds", generation: _generation, body: new ResponseBody
            {
                url = _modelUrl,
                bounds = bounds
            });
            StartCoroutine(EmitBoundsAfterStableFrame(_modelRevision, _generation));
        }

        private bool ClampAvatarToSurface(float minVisiblePixels)
        {
            if (_avatar == null ||
                !TryCalculateClampedAvatarPosition(minVisiblePixels, out var target) ||
                (target - _avatar.transform.position).sqrMagnitude < 0.00000001f)
            {
                return false;
            }
            _avatar.transform.position = target;
            return true;
        }

        private bool TryCalculateClampedAvatarPosition(float minVisiblePixels, out Vector3 target)
        {
            var candidate = _avatar != null ? _avatar.transform.position : Vector3.zero;
            return TryCalculateClampedAvatarPosition(candidate, minVisiblePixels, out target);
        }

        private bool TryCalculateClampedAvatarPosition(
            Vector3 candidate,
            float minVisiblePixels,
            out Vector3 target)
        {
            target = candidate;
            if (_avatar == null || _camera == null || !NekoAvatarProtocol.IsFiniteVector(candidate)) return false;
            var bounds = CalculateScreenBounds();
            if (bounds == null) return false;

            var currentProjection = _camera.WorldToViewportPoint(_avatar.transform.position);
            var targetProjection = _camera.WorldToViewportPoint(candidate);
            if (currentProjection.z <= 0f || targetProjection.z <= 0f) return false;
            var projectedDeltaX = (targetProjection.x - currentProjection.x) * _surfaceWidth;
            var projectedDeltaY = (currentProjection.y - targetProjection.y) * _surfaceHeight;

            var correctionX = NekoAvatarProtocol.CalculateVisibilityCorrection(
                bounds.minX + projectedDeltaX,
                bounds.maxX + projectedDeltaX,
                _surfaceWidth,
                minVisiblePixels);
            var correctionY = NekoAvatarProtocol.CalculateVisibilityCorrection(
                bounds.minY + projectedDeltaY,
                bounds.maxY + projectedDeltaY,
                _surfaceHeight,
                minVisiblePixels);
            if (Mathf.Approximately(correctionX, 0f) && Mathf.Approximately(correctionY, 0f)) return true;

            var worldPerPixel = _camera.orthographicSize * 2f / Mathf.Max(1f, _surfaceHeight);
            target += _camera.transform.right * (correctionX * worldPerPixel);
            target -= _camera.transform.up * (correctionY * worldPerPixel);
            return NekoAvatarProtocol.IsFiniteVector(target);
        }

        private void ZoomModel(float delta, float factor)
        {
            if (_avatar == null || _interactionLocked) return;
            CancelOrbit();
            ++_snapRevision;
            if (NekoAvatarProtocol.TryNormalizeZoomFactor(factor, out var multiplier))
            {
                var scale = _avatar.transform.localScale * multiplier;
                scale.x = Mathf.Clamp(scale.x, MinModelScale, MaxModelScale);
                scale.y = Mathf.Clamp(scale.y, MinModelScale, MaxModelScale);
                scale.z = Mathf.Clamp(scale.z, MinModelScale, MaxModelScale);
                _avatar.transform.localScale = scale;
                StartCoroutine(EmitBoundsAfterStableFrame(_modelRevision, _generation));
                return;
            }
            if (Mathf.Approximately(delta, 0f)) return;
            var wheelFactor = delta > 0f ? 0.95f : 1.05f;
            var current = _avatar.transform.localScale.x;
            var next = Mathf.Clamp(current * wheelFactor, MinModelScale, MaxModelScale);
            _avatar.transform.localScale = Vector3.one * next;
            StartCoroutine(EmitBoundsAfterStableFrame(_modelRevision, _generation));
        }

        private void InstallAnimationLayer(AnimationLayer layer, bool immediate, float fadeDuration)
        {
            if (_layeredAnimation == null)
            {
                var owner = _avatar;
                _layeredAnimation = new LayeredVrmAnimation(
                    owner,
                    key => owner != null ? owner.Runtime.Expression.GetWeight(key) : 0f);
            }
            _retiredAnimationLayers.Clear();
            if (immediate || fadeDuration <= 0f)
            {
                _layeredAnimation.Drain(_retiredAnimationLayers);
                layer.FadeTo(1f, 0f);
            }
            else
            {
                _layeredAnimation.FadeExistingToZero(fadeDuration);
                layer.FadeTo(1f, fadeDuration);
            }
            _layeredAnimation.Add(layer);
            ReleaseRetiredAnimationLayers();
            if (_avatar != null) _avatar.Runtime.VrmAnimation = _layeredAnimation;
        }

        private void AdvanceAnimationBlend(float deltaTime)
        {
            if (_layeredAnimation == null) return;
            _retiredAnimationLayers.Clear();
            _layeredAnimation.Advance(deltaTime, _retiredAnimationLayers);
            ReleaseRetiredAnimationLayers();
            if (_layeredAnimation.Count > 0) return;

            DetachAnimationAndRestoreReferencePose(_layeredAnimation);
            _layeredAnimation = null;
        }

        private void ReleaseRetiredAnimationLayers()
        {
            foreach (var layer in _retiredAnimationLayers) ReleaseAnimationLayer(layer);
            _retiredAnimationLayers.Clear();
        }

        private static void ReleaseAnimationLayer(AnimationLayer layer)
        {
            if (layer == null || layer.Released) return;
            layer.Released = true;
            DestroyAnimationSource(layer.Root, layer.Player);
        }

        private void SeekAnimation(float seconds, bool paused)
        {
            if (_animationPlayer == null) return;
            foreach (AnimationState state in _animationPlayer) state.time = Mathf.Clamp(seconds, 0f, state.length);
            _animationPlayer.Sample();
            _animationSeekPaused = paused;
            if (_activeAnimationLayer != null) _activeAnimationLayer.PlaybackPaused = paused;
            UpdateAnimationPlayerPauseStates();
        }

        private void UpdateAnimationPlayerPauseStates()
        {
            if (_layeredAnimation == null)
            {
                if (_animationPlayer != null) _animationPlayer.enabled = !_paused && !_animationSeekPaused;
                return;
            }
            foreach (var layer in _layeredAnimation.Layers) layer.SetRuntimePaused(_paused);
        }

        private void SetAnimationPaused(CommandEnvelope envelope)
        {
            if (_animationPlayer == null || string.IsNullOrEmpty(_animationActionId) ||
                envelope.body.actionId != _animationActionId)
            {
                ReplyOk(envelope, "animation.pauseIgnored", new ResponseBody
                {
                    actionId = _animationActionId,
                    playing = _animationWasPlaying
                });
                return;
            }
            _animationSeekPaused = envelope.body.paused;
            if (_activeAnimationLayer != null) _activeAnimationLayer.PlaybackPaused = _animationSeekPaused;
            UpdateAnimationPlayerPauseStates();
            ReplyOk(envelope, "animation.paused", new ResponseBody
            {
                actionId = _animationActionId,
                playing = _animationWasPlaying && !_animationSeekPaused
            });
        }

        private void StopAnimation(CommandEnvelope envelope)
        {
            if (envelope.body.preservePending)
            {
                if (string.IsNullOrEmpty(envelope.body.actionId) ||
                    envelope.body.actionId != _animationActionId)
                {
                    return;
                }
                FadeOutAnimation();
                RevealAvatarAfterInitialAnimation();
                return;
            }

            ++_animationRevision;
            CancelAnimationLoad(true);
            FadeOutAnimation();
            RevealAvatarAfterInitialAnimation();
        }

        private void FadeOutAnimation()
        {
            if (_layeredAnimation == null || _layeredAnimation.Count == 0 ||
                _paused || _animationSeekPaused ||
                (_activeAnimationLayer != null && _activeAnimationLayer.PlaybackPaused))
            {
                ReleaseAnimation();
                return;
            }

            _layeredAnimation.FadeExistingToZero(AnimationStopFadeSeconds);
            ClearActiveAnimationState();
        }

        private void UpdateMouth()
        {
            if (_weightedVisemesActive) return;
            _mouth = Mathf.MoveTowards(_mouth, _targetMouth, Time.unscaledDeltaTime * 12f);
            _avatar.Runtime.Expression.SetWeight(ExpressionKey.Aa, _mouth);
        }

        private void UpdateAnimationEvents()
        {
            if (_animationPlayer == null || !_animationWasPlaying) return;
            if (_animationLoop)
            {
                foreach (AnimationState state in _animationPlayer)
                {
                    if (!state.enabled) continue;
                    var loop = Mathf.FloorToInt(Mathf.Max(0f, state.normalizedTime));
                    if (loop > _lastAnimationLoop)
                    {
                        _lastAnimationLoop = loop;
                        Emit("animation.loop", generation: _generation, body: new ResponseBody
                        {
                            url = _animationUrl,
                            actionId = _animationActionId,
                            playing = true
                        });
                    }
                    break;
                }
                return;
            }
            AnimationState active = null;
            foreach (AnimationState state in _animationPlayer)
            {
                if (!state.enabled) continue;
                active = state;
                break;
            }
            if (active != null && !NekoAvatarProtocol.HasAnimationReachedEnd(active.time, active.length)) return;
            if (active == null && _animationPlayer.isPlaying) return;
            if (active != null)
            {
                active.time = active.length;
                active.speed = 0f;
                _animationPlayer.Sample();
            }
            _animationWasPlaying = false;
            Emit("animation.finished", generation: _generation, body: new ResponseBody
            {
                url = _animationUrl,
                actionId = _animationActionId,
                playing = false
            });
        }

        private void FitCameraToAvatar()
        {
            if (!TryGetAvatarBounds(out var bounds)) return;
            var aspect = Mathf.Max(0.1f, _surfaceWidth / Mathf.Max(1f, _surfaceHeight));
            _camera.aspect = aspect;
            _camera.orthographicSize = Mathf.Max(bounds.extents.y * 1.12f, bounds.extents.x * 1.12f / aspect, 0.25f);
            var distance = Mathf.Max(2.5f, bounds.size.magnitude * 1.6f);
            _camera.transform.position = bounds.center + Vector3.forward * distance;
            _camera.transform.LookAt(bounds.center, Vector3.up);
            UpdateCameraClipPlanes(bounds);
        }

        private void CaptureNativeFitBaseline()
        {
            if (_camera == null) return;
            _nativeFitPixelsPerUnit = _surfaceHeight /
                Mathf.Max(0.0001f, _camera.orthographicSize * 2f);
        }

        private void CaptureFitReferenceBounds()
        {
            _fitReferenceCorners = null;
            if (_avatar == null || !TryGetAvatarBounds(out var bounds)) return;
            var min = bounds.min;
            var max = bounds.max;
            _fitReferenceCorners = new Vector3[8];
            var index = 0;
            for (var x = 0; x < 2; ++x)
            for (var y = 0; y < 2; ++y)
            for (var z = 0; z < 2; ++z)
            {
                var world = new Vector3(
                    x == 0 ? min.x : max.x,
                    y == 0 ? min.y : max.y,
                    z == 0 ? min.z : max.z);
                _fitReferenceCorners[index++] = _avatar.transform.InverseTransformPoint(world);
            }
        }

        private bool TryGetFitReferenceBounds(out Bounds bounds)
        {
            bounds = default(Bounds);
            if (_avatar == null) return false;
            if (_fitReferenceCorners == null || _fitReferenceCorners.Length == 0)
            {
                CaptureFitReferenceBounds();
            }
            if (_fitReferenceCorners == null || _fitReferenceCorners.Length == 0) return false;

            bounds = new Bounds(_avatar.transform.TransformPoint(_fitReferenceCorners[0]), Vector3.zero);
            for (var index = 1; index < _fitReferenceCorners.Length; ++index)
            {
                bounds.Encapsulate(_avatar.transform.TransformPoint(_fitReferenceCorners[index]));
            }
            return bounds.size.sqrMagnitude > 0.000001f;
        }

        private void UpdateCameraClipPlanes(Bounds bounds)
        {
            var distance = Mathf.Max(0.01f, Vector3.Dot(bounds.center - _camera.transform.position, _camera.transform.forward));
            _camera.nearClipPlane = Mathf.Max(0.01f, distance - bounds.extents.magnitude * 2f);
            _camera.farClipPlane = distance + bounds.extents.magnitude * 3f + 10f;
        }

        private bool TryGetAvatarBounds(out Bounds bounds)
        {
            bounds = default(Bounds);
            if (_avatar == null) return false;
            var renderers = _avatar.GetComponentsInChildren<Renderer>(true);
            var hasBounds = false;
            foreach (var renderer in renderers)
            {
                if (!renderer.enabled) continue;
                if (!hasBounds)
                {
                    bounds = renderer.bounds;
                    hasBounds = true;
                }
                else bounds.Encapsulate(renderer.bounds);
            }
            return hasBounds && bounds.size.sqrMagnitude > 0.000001f;
        }

        private IEnumerator EmitBoundsAfterStableFrame(int revision, int generation)
        {
            yield return null;
            yield return new WaitForEndOfFrame();
            if (revision != _modelRevision || generation != _generation || _avatar == null) yield break;
            var bounds = CalculateScreenBounds();
            if (bounds == null) yield break;
            Emit("model.bounds", generation: generation, body: new ResponseBody { url = _modelUrl, bounds = bounds });
        }

        private BoundsBody CalculateScreenBounds()
        {
            if (!TryGetAvatarBounds(out var bounds)) return null;
            var min = bounds.min;
            var max = bounds.max;
            var corners = new[]
            {
                new Vector3(min.x, min.y, min.z), new Vector3(max.x, min.y, min.z),
                new Vector3(min.x, max.y, min.z), new Vector3(max.x, max.y, min.z),
                new Vector3(min.x, min.y, max.z), new Vector3(max.x, min.y, max.z),
                new Vector3(min.x, max.y, max.z), new Vector3(max.x, max.y, max.z)
            };
            var minX = float.PositiveInfinity;
            var minY = float.PositiveInfinity;
            var maxX = float.NegativeInfinity;
            var maxY = float.NegativeInfinity;
            var hasProjectedCorner = false;
            foreach (var corner in corners)
            {
                var point = _camera.WorldToViewportPoint(corner);
                if (point.z <= 0f) continue;
                hasProjectedCorner = true;
                minX = Mathf.Min(minX, point.x);
                minY = Mathf.Min(minY, point.y);
                maxX = Mathf.Max(maxX, point.x);
                maxY = Mathf.Max(maxY, point.y);
            }
            if (!hasProjectedCorner || maxX <= minX || maxY <= minY) return null;
            return new BoundsBody
            {
                minX = NekoAvatarProtocol.ViewportToCanvas(minX, _surfaceWidth, false),
                minY = NekoAvatarProtocol.ViewportToCanvas(maxY, _surfaceHeight, true),
                maxX = NekoAvatarProtocol.ViewportToCanvas(maxX, _surfaceWidth, false),
                maxY = NekoAvatarProtocol.ViewportToCanvas(minY, _surfaceHeight, true),
                head = CalculateHeadProjection(bounds)
            };
        }

        private HeadProjectionBody CalculateHeadProjection(Bounds avatarBounds)
        {
            var animator = _avatar != null ? _avatar.GetComponent<Animator>() : null;
            if (animator == null || !animator.isHuman) return null;
            var head = animator.GetBoneTransform(HumanBodyBones.Head);
            if (head == null) return null;

            var center = _camera.WorldToViewportPoint(head.position);
            if (center.z <= 0f) return null;
            var radius = Mathf.Max(0.01f, avatarBounds.size.y * 0.055f);
            var neck = animator.GetBoneTransform(HumanBodyBones.Neck);
            if (neck != null) radius = Mathf.Max(radius, Vector3.Distance(head.position, neck.position) * 0.9f);
            var right = _camera.WorldToViewportPoint(head.position + _camera.transform.right * radius);
            var up = _camera.WorldToViewportPoint(head.position + _camera.transform.up * radius);
            var x = Mathf.Clamp01(center.x) * _surfaceWidth;
            var y = (1f - Mathf.Clamp01(center.y)) * _surfaceHeight;
            var radiusX = Mathf.Max(4f, Mathf.Abs(right.x - center.x) * _surfaceWidth);
            var radiusY = Mathf.Max(4f, Mathf.Abs(up.y - center.y) * _surfaceHeight);
            return new HeadProjectionBody
            {
                x = x,
                y = y,
                minX = Mathf.Clamp(x - radiusX, 0f, _surfaceWidth),
                minY = Mathf.Clamp(y - radiusY, 0f, _surfaceHeight),
                maxX = Mathf.Clamp(x + radiusX, 0f, _surfaceWidth),
                maxY = Mathf.Clamp(y + radiusY, 0f, _surfaceHeight)
            };
        }

        private ResponseBody BuildModelResponse()
        {
            return new ResponseBody
            {
                url = _modelUrl,
                expressions = GetExpressionNames(),
                transform = BuildAvatarTransform(),
                bounds = CalculateScreenBounds()
            };
        }

        private TransformBody BuildAvatarTransform()
        {
            return new TransformBody
            {
                // Pose root offsets are transient presentation state, not the
                // persisted model transform exposed to the browser.
                position = new VectorBody(GetAvatarModelPosition()),
                rotation = new VectorBody(_avatar.transform.eulerAngles * Mathf.Deg2Rad),
                scale = new VectorBody(_avatar.transform.localScale)
            };
        }

        private Vector3 GetAvatarModelPosition()
        {
            return _avatar == null
                ? Vector3.zero
                : _avatar.transform.position - GetActivePoseRootOffset();
        }

        private void SetAvatarModelPosition(Vector3 position)
        {
            if (_avatar == null) return;
            _avatar.transform.position = position + GetActivePoseRootOffset();
        }

        private Vector3 GetActivePoseRootOffset()
        {
            return string.IsNullOrEmpty(_activePoseId) ? Vector3.zero : _poseRootOffset;
        }

        private void ReplyModelSnapshot(CommandEnvelope envelope)
        {
            if (_avatar == null)
            {
                EmitError(envelope.id, envelope.generation, "model_not_loaded", "No VRM model is loaded");
                return;
            }
            ReplyOk(envelope, "model.snapshot", new ResponseBody { transform = BuildAvatarTransform() });
        }

        private void ReplyModelOrientation(CommandEnvelope envelope)
        {
            if (_avatar == null || _camera == null)
            {
                EmitError(envelope.id, envelope.generation, "model_not_loaded", "No VRM model is loaded");
                return;
            }

            var currentRotation = _avatar.transform.eulerAngles * Mathf.Deg2Rad;
            var source = string.Empty;
            var needsRotation = false;
            var reliable = TryGetAvatarFacing(out var facing, out source) &&
                NekoAvatarProtocol.TryNeedsFacingCorrection(
                    facing,
                    _camera.transform.position - _avatar.transform.position,
                    out needsRotation);
            if (!reliable) needsRotation = false;
            var suggestedRotation = NekoAvatarProtocol.SuggestFacingRotation(
                currentRotation,
                reliable && needsRotation);
            ReplyOk(envelope, "model.orientation", new ResponseBody
            {
                needsRotation = reliable && needsRotation,
                orientationReliable = reliable,
                orientationSource = source,
                currentRotation = new VectorBody(currentRotation),
                suggestedRotation = new VectorBody(suggestedRotation)
            });
        }

        private bool TryGetAvatarFacing(out Vector3 facing, out string source)
        {
            facing = Vector3.zero;
            source = string.Empty;
            if (_avatar == null ||
                !_avatar.TryGetBoneTransform(HumanBodyBones.Head, out var head))
            {
                return false;
            }
            if (!_avatar.TryGetBoneTransform(HumanBodyBones.Chest, out var chest) &&
                !_avatar.TryGetBoneTransform(HumanBodyBones.Spine, out chest))
            {
                return false;
            }

            Transform left;
            Transform right;
            if (_avatar.TryGetBoneTransform(HumanBodyBones.LeftEye, out left) &&
                _avatar.TryGetBoneTransform(HumanBodyBones.RightEye, out right))
            {
                source = "eyes";
            }
            else if (_avatar.TryGetBoneTransform(HumanBodyBones.LeftShoulder, out left) &&
                     _avatar.TryGetBoneTransform(HumanBodyBones.RightShoulder, out right))
            {
                source = "shoulders";
            }
            else if (_avatar.TryGetBoneTransform(HumanBodyBones.LeftUpperArm, out left) &&
                     _avatar.TryGetBoneTransform(HumanBodyBones.RightUpperArm, out right))
            {
                source = "upperArms";
            }
            else
            {
                return false;
            }

            var rightAxis = right.position - left.position;
            var upAxis = head.position - chest.position;
            if (!NekoAvatarProtocol.IsFiniteVector(rightAxis) ||
                !NekoAvatarProtocol.IsFiniteVector(upAxis) ||
                rightAxis.sqrMagnitude <= 0.000001f || upAxis.sqrMagnitude <= 0.000001f)
            {
                source = string.Empty;
                return false;
            }
            facing = Vector3.Cross(rightAxis.normalized, upAxis.normalized);
            return NekoAvatarProtocol.IsFiniteVector(facing) && facing.sqrMagnitude > 0.000001f;
        }

        private void ReplyModelProfile(CommandEnvelope envelope)
        {
            if (string.IsNullOrEmpty(envelope.id)) return;
            if (_avatar == null)
            {
                EmitError(envelope.id, envelope.generation, "model_not_loaded", "No VRM model is loaded");
                return;
            }
            var payload = new ModelProfileEvent
            {
                replyTo = envelope.id,
                generation = envelope.generation,
                body = NekoAvatarProfiler.Capture(_avatar, _modelUrl, _surfaceWidth, _surfaceHeight)
            };
            NekoAvatarBrowserBridge.Emit(JsonUtility.ToJson(payload));
        }

        private void ReplyVmcSnapshot(CommandEnvelope envelope)
        {
            if (string.IsNullOrEmpty(envelope.id)) return;
            if (_avatar == null)
            {
                EmitError(envelope.id, envelope.generation, "model_not_loaded", "No VRM model is loaded");
                return;
            }
            var bones = new List<BoneSnapshotBody>();
            var restPose = new List<BoneSnapshotBody>();
            var expressions = new List<ExpressionSnapshotBody>();
            var animator = _avatar.GetComponent<Animator>();
            if (animator == null || !animator.isHuman)
            {
                EmitError(envelope.id, envelope.generation, "humanoid_unavailable", "The loaded VRM has no humanoid Animator");
                return;
            }
            var defaultStates = _avatar.DefaultTransformStates;
            for (var index = 0; index < (int)HumanBodyBones.LastBone; ++index)
            {
                var bone = (HumanBodyBones)index;
                var node = animator.GetBoneTransform(bone);
                if (node == null) continue;
                var protocolName = NekoAvatarProtocol.ToVrmHumanBoneName(bone.ToString());
                bones.Add(new BoneSnapshotBody
                {
                    name = protocolName,
                    localPosition = new VectorBody(NekoAvatarProtocol.UnityToBrowserPosition(node.localPosition)),
                    localRotation = new QuaternionBody(NekoAvatarProtocol.UnityToBrowserRotation(node.localRotation))
                });
                if (defaultStates.TryGetValue(node, out var rest))
                {
                    restPose.Add(new BoneSnapshotBody
                    {
                        name = protocolName,
                        localPosition = new VectorBody(NekoAvatarProtocol.UnityToBrowserPosition(rest.LocalPosition)),
                        localRotation = new QuaternionBody(NekoAvatarProtocol.UnityToBrowserRotation(rest.LocalRotation))
                    });
                }
            }
            if (restPose.Count == 0)
            {
                EmitError(envelope.id, envelope.generation, "rest_pose_unavailable", "The loaded VRM has no raw rest pose");
                return;
            }

            foreach (var key in _avatar.Runtime.Expression.ExpressionKeys)
            {
                expressions.Add(new ExpressionSnapshotBody
                {
                    name = key.Name,
                    value = NekoAvatarProtocol.Clamp01(_avatar.Runtime.Expression.GetWeight(key))
                });
            }

            var payload = new VmcSnapshotEvent
            {
                replyTo = envelope.id,
                generation = envelope.generation,
                body = new VmcSnapshotBody
                {
                    bones = bones.ToArray(),
                    restPose = restPose.ToArray(),
                    expressions = expressions.ToArray()
                }
            };
            NekoAvatarBrowserBridge.Emit(JsonUtility.ToJson(payload));
        }

        private bool TryFindExpression(string requestedName, out ExpressionKey found)
        {
            found = default(ExpressionKey);
            if (_avatar == null) return false;
            var normalized = NekoAvatarProtocol.NormalizeExpressionName(requestedName);
            foreach (var key in _avatar.Runtime.Expression.ExpressionKeys)
            {
                if (NekoAvatarProtocol.NormalizeExpressionName(key.Name) == normalized)
                {
                    found = key;
                    return true;
                }
            }
            return false;
        }

        private string[] GetExpressionNames()
        {
            if (_avatar == null) return Array.Empty<string>();
            var names = new List<string>();
            foreach (var key in _avatar.Runtime.Expression.ExpressionKeys) names.Add(key.Name);
            return names.ToArray();
        }

        private float GetAnimationDuration()
        {
            if (_animationPlayer == null) return 0f;
            foreach (AnimationState state in _animationPlayer) return state.length;
            return 0f;
        }

        private void CancelModelLoad(bool reply)
        {
            if (reply && !string.IsNullOrEmpty(_modelPendingId))
            {
                EmitError(_modelPendingId, _modelPendingGeneration, "superseded", "Model load was superseded");
            }
            _modelPendingId = null;
            if (_modelLoadCancellation == null) return;
            _modelLoadCancellation.Cancel();
            _modelLoadCancellation.Dispose();
            _modelLoadCancellation = null;
        }

        private void CancelAnimationLoad(bool reply)
        {
            if (reply && !string.IsNullOrEmpty(_animationPendingId))
            {
                EmitError(_animationPendingId, _animationPendingGeneration, "superseded", "Animation load was superseded");
            }
            _animationPendingId = null;
            if (_animationLoadCancellation == null) return;
            _animationLoadCancellation.Cancel();
            _animationLoadCancellation.Dispose();
            _animationLoadCancellation = null;
        }

        private void CompleteModelFailure(string commandId, int generation, string code, string message)
        {
            ClearModelPending(commandId);
            DisposeCompletedModelLoad();
            EmitError(commandId, generation, code, message);
        }

        private void CompleteAnimationFailure(string commandId, int generation, string code, string message)
        {
            if (generation == _generation) RevealAvatarAfterInitialAnimation();
            ClearAnimationPending(commandId);
            DisposeCompletedAnimationLoad();
            EmitError(commandId, generation, code, message);
        }

        private void DisposeCompletedModelLoad()
        {
            if (_modelLoadCancellation == null) return;
            _modelLoadCancellation.Dispose();
            _modelLoadCancellation = null;
        }

        private void DisposeCompletedAnimationLoad()
        {
            if (_animationLoadCancellation == null) return;
            _animationLoadCancellation.Dispose();
            _animationLoadCancellation = null;
        }

        private void ClearModelPending(string commandId)
        {
            if (_modelPendingId == commandId) _modelPendingId = null;
        }

        private void ClearAnimationPending(string commandId)
        {
            if (_animationPendingId == commandId) _animationPendingId = null;
        }

        private void ReleaseAvatar()
        {
            RevealAvatarAfterInitialAnimation();
            ClearPoseState(false);
            ClearAccessories();
            _modelVisibilityHiddenRenderers.Clear();
            if (_avatar != null)
            {
                RemoveOutlineMaterialBaselines(_avatar);
                Destroy(_avatar.gameObject);
            }
            _avatar = null;
            _modelUrl = null;
            _modelVisible = true;
            _targetMouth = 0f;
            _mouth = 0f;
            _weightedVisemesActive = false;
            _nativeFitPixelsPerUnit = 1f;
            _fitReferenceCorners = null;
            ClearVisemeWeights();
        }

        private void ReleaseAnimation()
        {
            _retiredAnimationLayers.Clear();
            if (_layeredAnimation != null)
            {
                _layeredAnimation.Drain(_retiredAnimationLayers);
                DetachAnimationAndRestoreReferencePose(_layeredAnimation);
                ReleaseRetiredAnimationLayers();
            }
            else
            {
                DestroyAnimationSource(_animationRoot, _animationPlayer);
            }
            _layeredAnimation = null;
            ClearActiveAnimationState();
        }

        private static void DetachAnimationAndRestoreReferencePose(LayeredVrmAnimation animation)
        {
            var owner = animation != null ? animation.Owner : null;
            if (owner == null || !ReferenceEquals(owner.Runtime.VrmAnimation, animation)) return;
            owner.Runtime.VrmAnimation = null;
            var rig = owner.Runtime.ControlRig;
            if (rig != null)
            {
                RestoreAnimationReferencePose(rig, rig);
                // LateUpdate normally applies the reset control rig. A paused
                // avatar has no automatic runtime pass, so only that path
                // needs an explicit process here; this avoids advancing
                // constraints and spring bones twice on ordinary stops.
                if (owner.UpdateType == Vrm10Instance.UpdateTypes.None)
                {
                    owner.Runtime.Process();
                }
            }
        }

        private static void RestoreAnimationReferencePose(
            INormalizedPoseApplicable pose,
            ITPoseProvider tPose)
        {
            if (pose == null || tPose == null) return;
            Vrm10Retarget.EnforceTPose((pose, tPose));
        }

        private void ClearActiveAnimationState()
        {
            _animationRoot = null;
            _vrma = null;
            _animationBridge = null;
            _animationPlayer = null;
            _activeAnimationLayer = null;
            _animationUrl = null;
            _animationActionId = null;
            _animationLoop = false;
            _animationWasPlaying = false;
            _animationSeekPaused = false;
            _lastAnimationLoop = 0;
        }

        private static void DestroyAnimationSource(RuntimeGltfInstance root, Animation player)
        {
            if (player != null) player.Stop();
            if (root != null) UnityEngine.Object.Destroy(root.gameObject);
        }

        private static byte[] InflateIfNeeded(byte[] bytes)
        {
            if (bytes == null || bytes.Length < 2 || bytes[0] != 0x1f || bytes[1] != 0x8b) return bytes;
            using (var input = new MemoryStream(bytes, false))
            using (var gzip = new GZipStream(input, CompressionMode.Decompress))
            using (var output = new MemoryStream())
            {
                gzip.CopyTo(output);
                return output.ToArray();
            }
        }

        private static Vector3 ToVector3(VectorBody value, Vector3 fallback)
        {
            if (value == null) return fallback;
            return new Vector3(value.x, value.y, value.z);
        }

        private static int NormalizeAntiAliasing(int value)
        {
            if (value >= 8) return 8;
            if (value >= 4) return 4;
            if (value >= 2) return 2;
            return 0;
        }

        private static IAwaitCaller CreateAwaitCaller()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            return new RuntimeOnlyNoThreadAwaitCaller();
#else
            return new RuntimeOnlyAwaitCaller();
#endif
        }

        private static CommandEnvelope ParseEnvelope(string json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            try
            {
                var envelope = new CommandEnvelope();
                JsonUtility.FromJsonOverwrite(json, envelope);
                return envelope;
            }
            catch (Exception) { return null; }
        }

        private static void ReplyOk(CommandEnvelope envelope, string name, ResponseBody body = null)
        {
            if (string.IsNullOrEmpty(envelope.id)) return;
            Emit(name, envelope.id, true, envelope.generation, body ?? new ResponseBody());
        }

        private static void EmitError(string replyTo, int generation, string code, string message)
        {
            Emit("command.error", replyTo, false, generation, new ResponseBody(), new ErrorBody
            {
                code = code,
                message = message
            });
        }

        private static void Emit(
            string name,
            string replyTo = null,
            bool ok = true,
            int generation = 0,
            ResponseBody body = null,
            ErrorBody error = null)
        {
            var payload = new RuntimeEvent
            {
                name = name,
                replyTo = replyTo,
                ok = ok,
                generation = generation,
                body = body ?? new ResponseBody(),
                error = error
            };
            NekoAvatarBrowserBridge.Emit(JsonUtility.ToJson(payload));
        }
    }
}
