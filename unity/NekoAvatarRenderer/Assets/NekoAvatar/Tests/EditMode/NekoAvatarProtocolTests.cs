using System;
using System.Collections;
using System.Collections.Generic;
using System.Reflection;
using System.Text.RegularExpressions;
using NUnit.Framework;
using UniGLTF.Utils;
using UniVRM10;
using UnityEngine;
using UnityEngine.TestTools;

namespace Neko.Avatar.Tests
{
    public sealed class NekoAvatarProtocolTests
    {
        private static object ParseCommandEnvelope(string json)
        {
            var method = typeof(NekoAvatarController).GetMethod(
                "ParseEnvelope",
                BindingFlags.Static | BindingFlags.NonPublic);
            Assert.That(method, Is.Not.Null);
            return method.Invoke(null, new object[] { json });
        }

        private sealed class StubPoseProvider : INormalizedPoseProvider
        {
            public Vector3 Hips = new Vector3(9f, 8f, 7f);
            public Quaternion Rotation = Quaternion.Euler(10f, 20f, 30f);
            public Vector3 GetRawHipsPosition() => Hips;
            public Quaternion GetNormalizedLocalRotation(HumanBodyBones bone, HumanBodyBones parentBone) => Rotation;
        }

        private sealed class StubTPoseProvider : ITPoseProvider
        {
            public Vector3 Hips = new Vector3(1f, 2f, 3f);

            public EuclideanTransform? GetWorldTransform(HumanBodyBones bone)
            {
                return bone == HumanBodyBones.Hips
                    ? new EuclideanTransform(Hips)
                    : (EuclideanTransform?)null;
            }
        }

        private sealed class StubReferencePoseTarget : INormalizedPoseApplicable, ITPoseProvider
        {
            public Vector3 Hips = new Vector3(9f, 8f, 7f);
            public Quaternion HipsRotation = Quaternion.Euler(10f, 20f, 30f);

            public void SetRawHipsPosition(Vector3 position) => Hips = position;

            public void SetNormalizedLocalRotation(HumanBodyBones bone, Quaternion rotation)
            {
                if (bone == HumanBodyBones.Hips) HipsRotation = rotation;
            }

            public EuclideanTransform? GetWorldTransform(HumanBodyBones bone)
            {
                return bone == HumanBodyBones.Hips
                    ? new EuclideanTransform(new Vector3(0f, 2f, 0f))
                    : (EuclideanTransform?)null;
            }
        }

        private sealed class StubVrmAnimation : IVrm10Animation
        {
            private readonly Dictionary<ExpressionKey, Func<float>> _expressions =
                new Dictionary<ExpressionKey, Func<float>>(ExpressionKey.Comparer);
            private readonly StubPoseProvider _pose;
            private readonly StubTPoseProvider _tPose;

            public StubVrmAnimation(
                Quaternion rotation,
                Vector3 rawHips,
                Vector3 restHips,
                ExpressionKey? expression = null,
                float expressionValue = 0f)
            {
                _pose = new StubPoseProvider { Rotation = rotation, Hips = rawHips };
                _tPose = new StubTPoseProvider { Hips = restHips };
                if (expression.HasValue)
                {
                    var value = expressionValue;
                    _expressions.Add(expression.Value, () => value);
                }
            }

            public (INormalizedPoseProvider, ITPoseProvider) ControlRig => (_pose, _tPose);
            public IReadOnlyDictionary<ExpressionKey, Func<float>> ExpressionMap => _expressions;
            public LookAtInput? LookAt => null;
            public void ShowBoxMan(bool enable) { }
            public void SetBoxManMaterial(Material material) { }
            public void Dispose() { }
        }

        [Test]
        public void BrowserContractUsesTheManagedRuntimeObject()
        {
            Assert.That(NekoAvatarProtocol.Version, Is.EqualTo(1));
            Assert.That(NekoAvatarProtocol.ControllerObjectName, Is.EqualTo("NekoAvatarRuntime"));
        }

        [TestCase(-1f, 0f)]
        [TestCase(0f, 0f)]
        [TestCase(0.35f, 0.35f)]
        [TestCase(1f, 1f)]
        [TestCase(2f, 1f)]
        public void Clamp01KeepsProtocolValuesBounded(float input, float expected)
        {
            Assert.That(NekoAvatarProtocol.Clamp01(input), Is.EqualTo(expected).Within(0.0001f));
        }

        [Test]
        public void Clamp01RejectsNonFiniteValues()
        {
            Assert.That(NekoAvatarProtocol.Clamp01(float.NaN), Is.Zero);
            Assert.That(NekoAvatarProtocol.Clamp01(float.PositiveInfinity), Is.Zero);
        }

        [TestCase("/static/vrm/sister1.0.vrm", "/static/vrm/sister1.0.vrm")]
        [TestCase("https://example.test/avatar.vrm", "https://example.test/avatar.vrm")]
        [TestCase(" http://127.0.0.1:48911/user_vrm/a.vrm ", "http://127.0.0.1:48911/user_vrm/a.vrm")]
        [TestCase("blob:http://127.0.0.1:48911/7d093bbb-1bd7-44b8-aead-9aa84298cd80", "blob:http://127.0.0.1:48911/7d093bbb-1bd7-44b8-aead-9aa84298cd80")]
        [TestCase("blob:https://example.test/82af2302-9d97-4f19-b706-32f986da2675", "blob:https://example.test/82af2302-9d97-4f19-b706-32f986da2675")]
        public void AssetUrlsAcceptSupportedWebSources(string input, string expected)
        {
            Assert.That(NekoAvatarProtocol.TryNormalizeAssetUrl(input, out var actual), Is.True);
            Assert.That(actual, Is.EqualTo(expected));
        }

        [TestCase("")]
        [TestCase("relative/model.vrm")]
        [TestCase("//other.example/model.vrm")]
        [TestCase("file:///tmp/model.vrm")]
        [TestCase("blob:file:///tmp/model.vrma")]
        [TestCase("blob:javascript:alert(1)")]
        [TestCase("javascript:alert(1)")]
        [TestCase("data:application/octet-stream;base64,AA==")]
        public void AssetUrlsRejectUntrustedSchemesAndAmbiguousPaths(string input)
        {
            Assert.That(NekoAvatarProtocol.TryNormalizeAssetUrl(input, out _), Is.False);
        }

        [TestCase("joy", "happy")]
        [TestCase("FUN", "relaxed")]
        [TestCase("sorrow", "sad")]
        [TestCase("surprise", "surprised")]
        [TestCase("blink-left", "blinkleft")]
        [TestCase("A", "aa")]
        public void ExpressionNamesPreserveExistingNekoAliases(string input, string expected)
        {
            Assert.That(NekoAvatarProtocol.NormalizeExpressionName(input), Is.EqualTo(expected));
        }

        [Test]
        public void InvariantFloatParsingDoesNotFollowDesktopLocale()
        {
            Assert.That(NekoAvatarProtocol.TryParseInvariantFloat("0.75", out var value), Is.True);
            Assert.That(value, Is.EqualTo(0.75f).Within(0.0001f));
            Assert.That(NekoAvatarProtocol.TryParseInvariantFloat("0,75", out _), Is.False);
            Assert.That(NekoAvatarProtocol.TryParseInvariantFloat("NaN", out _), Is.False);
        }

        [TestCase(0f, 1f)]
        [TestCase(-1f, 1f)]
        [TestCase(0.9f, 0.9f)]
        [TestCase(10f, 4f)]
        public void PlaybackSpeedHasSafeProtocolBounds(float input, float expected)
        {
            Assert.That(NekoAvatarProtocol.NormalizePlaybackSpeed(input), Is.EqualTo(expected).Within(0.0001f));
        }

        [Test]
        public void TargetFrameRateDistinguishesUnlimitedFromUnspecified()
        {
            Assert.That(NekoAvatarProtocol.TryNormalizeTargetFrameRate(-1, out _), Is.False);
            Assert.That(NekoAvatarProtocol.TryNormalizeTargetFrameRate(0, out var unlimited), Is.True);
            Assert.That(unlimited, Is.EqualTo(-1));
            Assert.That(NekoAvatarProtocol.TryNormalizeTargetFrameRate(10, out var minimum), Is.True);
            Assert.That(minimum, Is.EqualTo(15));
            Assert.That(NekoAvatarProtocol.TryNormalizeTargetFrameRate(60, out var normal), Is.True);
            Assert.That(normal, Is.EqualTo(60));
            Assert.That(NekoAvatarProtocol.TryNormalizeTargetFrameRate(240, out var maximum), Is.True);
            Assert.That(maximum, Is.EqualTo(120));
        }

        [Test]
        public void ZoomFactorSupportsTouchRatiosWithoutChangingWheelFallback()
        {
            Assert.That(NekoAvatarProtocol.TryNormalizeZoomFactor(0f, out _), Is.False);
            Assert.That(NekoAvatarProtocol.TryNormalizeZoomFactor(float.NaN, out _), Is.False);
            Assert.That(NekoAvatarProtocol.TryNormalizeZoomFactor(0.1f, out var minimum), Is.True);
            Assert.That(minimum, Is.EqualTo(0.2f).Within(0.0001f));
            Assert.That(NekoAvatarProtocol.TryNormalizeZoomFactor(1.25f, out var ratio), Is.True);
            Assert.That(ratio, Is.EqualTo(1.25f).Within(0.0001f));
            Assert.That(NekoAvatarProtocol.TryNormalizeZoomFactor(10f, out var maximum), Is.True);
            Assert.That(maximum, Is.EqualTo(5f).Within(0.0001f));
        }

        [TestCase(-500f, -100f, 800f, 200f, 300f)]
        [TestCase(-300f, 150f, 800f, 200f, 50f)]
        [TestCase(700f, 1000f, 800f, 200f, -100f)]
        [TestCase(100f, 700f, 800f, 200f, 0f)]
        [TestCase(-100f, 900f, 800f, 200f, 0f)]
        [TestCase(150f, 250f, 100f, 200f, -150f)]
        public void VisibilityClampKeepsTheOldMinimumPixelContract(
            float modelMin,
            float modelMax,
            float surfaceSize,
            float minVisiblePixels,
            float expected)
        {
            Assert.That(
                NekoAvatarProtocol.CalculateVisibilityCorrection(
                    modelMin,
                    modelMax,
                    surfaceSize,
                    minVisiblePixels),
                Is.EqualTo(expected).Within(0.0001f));
        }

        [Test]
        public void VisibilityClampHasStableDefaultsAndSnapEasing()
        {
            Assert.That(
                NekoAvatarProtocol.NormalizeMinVisiblePixels(0f),
                Is.EqualTo(NekoAvatarProtocol.DefaultMinVisiblePixels));
            Assert.That(
                NekoAvatarProtocol.NormalizeMinVisiblePixels(float.NaN),
                Is.EqualTo(NekoAvatarProtocol.DefaultMinVisiblePixels));
            Assert.That(NekoAvatarProtocol.EaseOutBack(0f), Is.Zero.Within(0.0001f));
            Assert.That(NekoAvatarProtocol.EaseOutBack(1f), Is.EqualTo(1f).Within(0.0001f));
            Assert.That(NekoAvatarProtocol.EaseOutBack(0.8f), Is.GreaterThan(1f));
        }

        [Test]
        public void OrbitUsesTheOldCumulativeWorldAxisRotationContract()
        {
            var yaw = NekoAvatarProtocol.CalculateOrbitDelta(100f, 0f);
            var yawedForward = yaw * Vector3.forward;
            Assert.That(yawedForward.x, Is.EqualTo(Mathf.Sin(0.5f)).Within(0.0001f));
            Assert.That(yawedForward.y, Is.Zero.Within(0.0001f));
            Assert.That(yawedForward.z, Is.EqualTo(Mathf.Cos(0.5f)).Within(0.0001f));

            var pitch = NekoAvatarProtocol.CalculateOrbitDelta(0f, 100f);
            var pitchedForward = pitch * Vector3.forward;
            Assert.That(pitchedForward.y, Is.EqualTo(-Mathf.Sin(0.5f)).Within(0.0001f));
            Assert.That(pitchedForward.z, Is.EqualTo(Mathf.Cos(0.5f)).Within(0.0001f));
            Assert.That(
                Quaternion.Angle(
                    NekoAvatarProtocol.CalculateOrbitDelta(float.NaN, 2f),
                    Quaternion.identity),
                Is.Zero.Within(0.0001f));
        }

        [Test]
        public void GuidedMovementNormalizesSpeedAndTurnsAcrossTheYawSeam()
        {
            Assert.That(NekoAvatarProtocol.NormalizeMovementMaxSpeed(float.NaN), Is.Zero);
            Assert.That(NekoAvatarProtocol.NormalizeMovementMaxSpeed(-1f), Is.Zero);
            Assert.That(NekoAvatarProtocol.NormalizeMovementMaxSpeed(0.4f), Is.EqualTo(0.4f));
            Assert.That(NekoAvatarProtocol.NormalizeMovementMaxSpeed(4f), Is.EqualTo(0.9f));
            Assert.That(
                NekoAvatarProtocol.NormalizePositiveMovementValue(float.NaN, 2.8f),
                Is.EqualTo(2.8f));
            Assert.That(
                NekoAvatarProtocol.NormalizePositiveMovementValue(-2f, 4.2f),
                Is.EqualTo(4.2f));
            Assert.That(
                NekoAvatarProtocol.NormalizePositiveMovementValue(0.25f, 0.012f),
                Is.EqualTo(0.25f));

            var accelerated = NekoAvatarProtocol.CalculateMovementVelocity(
                0f, 2f, 0.1f, 0.9f, 2.8f, 4.2f, 0.012f);
            Assert.That(accelerated, Is.EqualTo(0.28f).Within(0.0001f));
            var decelerated = NekoAvatarProtocol.CalculateMovementVelocity(
                0.8f, 0.02f, 0.1f, 0.9f, 2.8f, 4.2f, 0.012f);
            Assert.That(decelerated, Is.EqualTo(0.38f).Within(0.0001f));

            var from = 170f * Mathf.Deg2Rad;
            var to = -170f * Mathf.Deg2Rad;
            Assert.That(
                NekoAvatarProtocol.ShortestAngleDelta(from, to),
                Is.EqualTo(20f * Mathf.Deg2Rad).Within(0.0001f));
            Assert.That(
                NekoAvatarProtocol.GetWorldYaw(Quaternion.AngleAxis(70f, Vector3.up)),
                Is.EqualTo(70f * Mathf.Deg2Rad).Within(0.0001f));
        }

        [Test]
        public void OrientationCorrectionRequiresClearFacingEvidence()
        {
            Assert.That(
                NekoAvatarProtocol.TryNeedsFacingCorrection(
                    Vector3.forward,
                    Vector3.forward,
                    out var forwardNeedsRotation),
                Is.True);
            Assert.That(forwardNeedsRotation, Is.False);

            Assert.That(
                NekoAvatarProtocol.TryNeedsFacingCorrection(
                    Vector3.back,
                    Vector3.forward,
                    out var backwardNeedsRotation),
                Is.True);
            Assert.That(backwardNeedsRotation, Is.True);

            Assert.That(
                NekoAvatarProtocol.TryNeedsFacingCorrection(
                    Vector3.right,
                    Vector3.forward,
                    out var sidewaysNeedsRotation),
                Is.False);
            Assert.That(sidewaysNeedsRotation, Is.False);

            var current = new Vector3(0.1f, 0.25f, -0.2f);
            var suggested = NekoAvatarProtocol.SuggestFacingRotation(current, true);
            Assert.That(suggested.x, Is.EqualTo(current.x));
            Assert.That(suggested.z, Is.EqualTo(current.z));
            Assert.That(
                Mathf.Abs(NekoAvatarProtocol.ShortestAngleDelta(current.y, suggested.y)),
                Is.EqualTo(Mathf.PI).Within(0.0001f));
        }

        [Test]
        public void ActiveRetargetToCurrentRestoresOriginalYawBeforeCompletion()
        {
            var controllerObject = new GameObject("guided-retarget-controller");
            var avatarObject = new GameObject("guided-retarget-avatar");
            controllerObject.SetActive(false);
            avatarObject.SetActive(false);
            FieldInfo avatarField = null;
            try
            {
                var controller = controllerObject.AddComponent<NekoAvatarController>();
                var avatar = avatarObject.AddComponent<Vrm10Instance>();
                avatar.transform.rotation = Quaternion.AngleAxis(90f, Vector3.up);

                var envelopeType = typeof(NekoAvatarController).GetNestedType(
                    "CommandEnvelope",
                    BindingFlags.NonPublic);
                var stateType = typeof(NekoAvatarController).GetNestedType(
                    "GuidedMovementState",
                    BindingFlags.NonPublic);
                var envelope = Activator.CreateInstance(envelopeType, true);
                envelopeType.GetField("id").SetValue(envelope, "retarget-current");
                envelopeType.GetField("generation").SetValue(envelope, 7);
                var state = Activator.CreateInstance(stateType, true);
                stateType.GetField("Envelope").SetValue(state, envelope);
                stateType.GetField("Avatar").SetValue(state, avatar);
                stateType.GetField("ModelRevision").SetValue(state, 4);
                stateType.GetField("ActionId").SetValue(state, "move-retarget");
                stateType.GetField("RestYaw").SetValue(state, 0f);
                stateType.GetField("NextBoundsAt").SetValue(state, float.MaxValue);

                avatarField = typeof(NekoAvatarController).GetField(
                    "_avatar",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                var movementField = typeof(NekoAvatarController).GetField(
                    "_guidedMovement",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                typeof(NekoAvatarController).GetField(
                    "_modelRevision",
                    BindingFlags.Instance | BindingFlags.NonPublic).SetValue(controller, 4);
                typeof(NekoAvatarController).GetField(
                    "_generation",
                    BindingFlags.Instance | BindingFlags.NonPublic).SetValue(controller, 7);
                avatarField.SetValue(controller, avatar);
                movementField.SetValue(controller, state);

                var beginRestore = typeof(NekoAvatarController).GetMethod(
                    "BeginMovementYawRestore",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                var updateMovement = typeof(NekoAvatarController).GetMethod(
                    "UpdateGuidedMovement",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                LogAssert.Expect(
                    LogType.Log,
                    new Regex("\\[NekoAvatarEvent\\].*model\\.moveArrived"));
                beginRestore.Invoke(controller, new[] { state });

                Assert.That((bool)stateType.GetField("Arrived").GetValue(state), Is.True);
                Assert.That((bool)stateType.GetField("RestoringYaw").GetValue(state), Is.True);
                Assert.That(movementField.GetValue(controller), Is.SameAs(state));

                updateMovement.Invoke(controller, new object[] { 0.18f });
                Assert.That(
                    NekoAvatarProtocol.GetWorldYaw(avatar.transform.rotation),
                    Is.EqualTo(45f * Mathf.Deg2Rad).Within(0.01f));
                Assert.That(movementField.GetValue(controller), Is.SameAs(state));

                LogAssert.Expect(
                    LogType.Log,
                    new Regex("\\[NekoAvatarEvent\\].*model\\.moveCompleted"));
                updateMovement.Invoke(controller, new object[] { 0.18f });
                Assert.That(
                    NekoAvatarProtocol.GetWorldYaw(avatar.transform.rotation),
                    Is.Zero.Within(0.0001f));
                Assert.That(movementField.GetValue(controller), Is.Null);
                avatarField.SetValue(controller, null);
            }
            finally
            {
                if (avatarField != null)
                {
                    var controller = controllerObject.GetComponent<NekoAvatarController>();
                    if (controller != null) avatarField.SetValue(controller, null);
                }
                UnityEngine.Object.DestroyImmediate(controllerObject);
                UnityEngine.Object.DestroyImmediate(avatarObject);
            }
        }

        [TestCase("LeftThumbProximal", "LeftThumbMetacarpal")]
        [TestCase("LeftThumbIntermediate", "LeftThumbProximal")]
        [TestCase("RightThumbProximal", "RightThumbMetacarpal")]
        [TestCase("RightThumbIntermediate", "RightThumbProximal")]
        [TestCase("LeftIndexIntermediate", "LeftIndexIntermediate")]
        public void HumanBoneNamesFollowTheVrmVmcThumbConvention(string input, string expected)
        {
            Assert.That(NekoAvatarProtocol.ToVrmHumanBoneName(input), Is.EqualTo(expected));
        }

        [TestCase("hips", HumanBodyBones.Hips)]
        [TestCase("upperChest", HumanBodyBones.UpperChest)]
        [TestCase("leftThumbMetacarpal", HumanBodyBones.LeftThumbProximal)]
        [TestCase("leftThumbProximal", HumanBodyBones.LeftThumbIntermediate)]
        public void BrowserBoneNamesResolveToRawAnimatorBones(string input, HumanBodyBones expected)
        {
            Assert.That(NekoAvatarProtocol.TryParseHumanBoneName(input, out var actual), Is.True);
            Assert.That(actual, Is.EqualTo(expected));
        }

        [TestCase("LOW", "low")]
        [TestCase(" medium ", "medium")]
        [TestCase("high", "high")]
        [TestCase("ultra", "")]
        public void QualityPresetOnlyAcceptsTheBrowserContract(string input, string expected)
        {
            Assert.That(NekoAvatarProtocol.NormalizeQualityPreset(input), Is.EqualTo(expected));
        }

        [Test]
        public void OrthographicFitMatchesTheSharedRectanglePolicy()
        {
            Assert.That(
                NekoAvatarProtocol.CalculateFitPixelsPerUnit(
                    "contain", 188f, 288f, 2f, 2f, 50f, 1f, true, 0f, 0f),
                Is.EqualTo(94f).Within(0.0001f));
            Assert.That(
                NekoAvatarProtocol.CalculateFitPixelsPerUnit(
                    "height", 188f, 288f, 2f, 2f, 50f, 0.5f, true, 0f, 0f),
                Is.EqualTo(72f).Within(0.0001f));
            Assert.That(
                NekoAvatarProtocol.CalculateFitPixelsPerUnit(
                    "native", 188f, 288f, 2f, 2f, 50f, 2f, true, 0f, 0f),
                Is.EqualTo(100f).Within(0.0001f));
            var nativeBaseline = 50f;
            var first = NekoAvatarProtocol.CalculateFitPixelsPerUnit(
                "native", 188f, 288f, 2f, 2f, nativeBaseline, 2f, true, 0f, 0f);
            var repeated = NekoAvatarProtocol.CalculateFitPixelsPerUnit(
                "native", 388f, 168f, 2f, 2f, nativeBaseline, 2f, true, 0f, 0f);
            Assert.That(repeated, Is.EqualTo(first).Within(0.0001f));
        }

        [Test]
        public void NonLoopingAnimationFinishesAtAndKeepsItsLastSample()
        {
            Assert.That(NekoAvatarProtocol.HasAnimationReachedEnd(0.999f, 1f), Is.False);
            Assert.That(NekoAvatarProtocol.HasAnimationReachedEnd(1f, 1f), Is.True);
            Assert.That(NekoAvatarProtocol.HasAnimationReachedEnd(0f, 0f), Is.True);
        }

        [Test]
        public void OutlineScaleAlwaysUsesTheImportedMaterialBaseline()
        {
            const float importedWidth = 0.004f;
            Assert.That(NekoAvatarProtocol.ScaleOutlineWidth(importedWidth, 0f), Is.Zero);
            Assert.That(NekoAvatarProtocol.ScaleOutlineWidth(importedWidth, 1.5f), Is.EqualTo(0.006f).Within(0.000001f));
            Assert.That(NekoAvatarProtocol.ScaleOutlineWidth(importedWidth, 1.5f), Is.EqualTo(0.006f).Within(0.000001f));
        }

        [Test]
        public void ProjectedBoundsRemainUnclippedOutsideTheCanvas()
        {
            Assert.That(NekoAvatarProtocol.ViewportToCanvas(-0.25f, 200f, false), Is.EqualTo(-50f));
            Assert.That(NekoAvatarProtocol.ViewportToCanvas(1.25f, 200f, false), Is.EqualTo(250f));
            Assert.That(NekoAvatarProtocol.ViewportToCanvas(1.25f, 300f, true), Is.EqualTo(-75f));
        }

        [Test]
        public void VmcSnapshotsConvertUnityLeftHandedTransformsToBrowserRightHandedTransforms()
        {
            var position = NekoAvatarProtocol.UnityToBrowserPosition(new Vector3(1f, 2f, 3f));
            var rotation = NekoAvatarProtocol.UnityToBrowserRotation(new Quaternion(0.1f, 0.2f, 0.3f, 0.9f));

            Assert.That(position, Is.EqualTo(new Vector3(1f, 2f, -3f)));
            Assert.That(rotation.x, Is.EqualTo(-0.1f).Within(0.0001f));
            Assert.That(rotation.y, Is.EqualTo(-0.2f).Within(0.0001f));
            Assert.That(rotation.z, Is.EqualTo(0.3f).Within(0.0001f));
            Assert.That(rotation.w, Is.EqualTo(0.9f).Within(0.0001f));
        }

        [Test]
        public void SurfaceSyncWaitsForTheRenderedFrameBeforeReplying()
        {
            Assert.That(NekoAvatarProtocol.SurfaceSyncCommand, Is.EqualTo("surface.sync"));
            var method = typeof(NekoAvatarController).GetMethod(
                "ReplyAfterEndOfFrame",
                BindingFlags.Instance | BindingFlags.NonPublic);
            Assert.That(method, Is.Not.Null);

            var gameObject = new GameObject("surface-sync-contract");
            gameObject.SetActive(false);
            try
            {
                var controller = gameObject.AddComponent<NekoAvatarController>();
                var envelopeType = typeof(NekoAvatarController).GetNestedType(
                    "CommandEnvelope",
                    BindingFlags.NonPublic);
                var envelope = Activator.CreateInstance(envelopeType, true);
                var iterator = (IEnumerator)method.Invoke(controller, new[] { envelope });

                Assert.That(iterator.MoveNext(), Is.True);
                Assert.That(iterator.Current, Is.TypeOf<WaitForEndOfFrame>());
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(gameObject);
            }
        }

        [Test]
        public void FailedModelLoadKeepsThePreviousAvatarOnTheNewGeneration()
        {
            var controllerObject = new GameObject("failed-load-controller");
            var previousObject = new GameObject("failed-load-previous-avatar");
            var candidateObject = new GameObject("failed-load-candidate-avatar");
            var cameraObject = new GameObject("failed-load-camera");
            controllerObject.SetActive(false);
            previousObject.SetActive(false);
            candidateObject.SetActive(false);
            cameraObject.SetActive(false);
            FieldInfo avatarField = null;
            try
            {
                var controller = controllerObject.AddComponent<NekoAvatarController>();
                var previous = previousObject.AddComponent<Vrm10Instance>();
                var candidate = candidateObject.AddComponent<Vrm10Instance>();
                var camera = cameraObject.AddComponent<Camera>();
                camera.orthographic = true;
                camera.orthographicSize = 2f;
                camera.transform.position = new Vector3(0f, 0f, 10f);
                camera.transform.rotation = Quaternion.LookRotation(Vector3.back, Vector3.up);

                avatarField = typeof(NekoAvatarController).GetField(
                    "_avatar",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                var generationField = typeof(NekoAvatarController).GetField(
                    "_generation",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                var cameraField = typeof(NekoAvatarController).GetField(
                    "_camera",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                avatarField.SetValue(controller, previous);
                generationField.SetValue(controller, 2);
                cameraField.SetValue(controller, camera);
                typeof(NekoAvatarController).GetField(
                    "_lookAtEnabled",
                    BindingFlags.Instance | BindingFlags.NonPublic).SetValue(controller, false);

                var invalidEnvelope = ParseCommandEnvelope(
                    "{\"v\":1,\"id\":\"invalid-load\",\"generation\":3,\"command\":\"model.load\","
                    + "\"body\":{\"url\":\"file:///tmp/not-allowed.vrm\"}}");
                var beginLoad = typeof(NekoAvatarController).GetMethod(
                    "BeginModelLoad",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                LogAssert.Expect(
                    LogType.Log,
                    new Regex("\\[NekoAvatarEvent\\].*invalid_model_url"));
                beginLoad.Invoke(controller, new[] { invalidEnvelope });
                Assert.That((int)generationField.GetValue(controller), Is.EqualTo(3));
                Assert.That(avatarField.GetValue(controller), Is.SameAs(previous));
                AssertFailedLoadAvatarCommandsUseGeneration(controller, 3, "invalid");

                generationField.SetValue(controller, 4);
                var completeFailure = typeof(NekoAvatarController).GetMethod(
                    "CompleteModelFailure",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                LogAssert.Expect(
                    LogType.Log,
                    new Regex("\\[NekoAvatarEvent\\].*model_download_failed"));
                completeFailure.Invoke(controller, new object[]
                {
                    "download-load", 4, "model_download_failed", "offline"
                });
                Assert.That((int)generationField.GetValue(controller), Is.EqualTo(4));
                Assert.That(avatarField.GetValue(controller), Is.SameAs(previous));
                AssertFailedLoadAvatarCommandsUseGeneration(controller, 4, "download");

                generationField.SetValue(controller, 5);
                avatarField.SetValue(controller, candidate);
                var restorePrevious = typeof(NekoAvatarController).GetMethod(
                    "RestorePreviousAvatar",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                restorePrevious.Invoke(controller, new object[]
                {
                    previous, "/old-avatar.vrm", null, true, null
                });
                LogAssert.Expect(
                    LogType.Log,
                    new Regex("\\[NekoAvatarEvent\\].*model_import_failed"));
                completeFailure.Invoke(controller, new object[]
                {
                    "import-load", 5, "model_import_failed", "invalid glTF"
                });
                Assert.That((int)generationField.GetValue(controller), Is.EqualTo(5));
                Assert.That(avatarField.GetValue(controller), Is.SameAs(previous));
                AssertFailedLoadAvatarCommandsUseGeneration(controller, 5, "import");
                avatarField.SetValue(controller, null);
            }
            finally
            {
                if (avatarField != null)
                {
                    var controller = controllerObject.GetComponent<NekoAvatarController>();
                    if (controller != null) avatarField.SetValue(controller, null);
                }
                UnityEngine.Object.DestroyImmediate(controllerObject);
                UnityEngine.Object.DestroyImmediate(previousObject);
                UnityEngine.Object.DestroyImmediate(candidateObject);
                UnityEngine.Object.DestroyImmediate(cameraObject);
            }
        }

        private static void AssertFailedLoadAvatarCommandsUseGeneration(
            NekoAvatarController controller,
            int generation,
            string suffix)
        {
            LogAssert.Expect(
                LogType.Log,
                new Regex("\\[NekoAvatarEvent\\].*model\\.snapshot"));
            controller.HandleCommand(
                "{\"v\":1,\"id\":\"snapshot-" + suffix + "\",\"generation\":" + generation
                + ",\"command\":\"model.snapshot\",\"body\":{}}");

            LogAssert.Expect(
                LogType.Log,
                new Regex("\\[NekoAvatarEvent\\].*invalid_screen_target"));
            controller.HandleCommand(
                "{\"v\":1,\"id\":\"move-" + suffix + "\",\"generation\":" + generation
                + ",\"command\":\"model.moveToScreen\",\"body\":{\"actionId\":\"move-" + suffix
                + "\",\"x\":0.5,\"y\":0.5,\"maxSpeed\":0.4}}");
        }

        [Test]
        public void SeekPausedFalseResumesOnlyTheAnimationPlayer()
        {
            var method = typeof(NekoAvatarController).GetMethod(
                "SeekAnimation",
                BindingFlags.Instance | BindingFlags.NonPublic);
            var playerField = typeof(NekoAvatarController).GetField(
                "_animationPlayer",
                BindingFlags.Instance | BindingFlags.NonPublic);
            var seekPausedField = typeof(NekoAvatarController).GetField(
                "_animationSeekPaused",
                BindingFlags.Instance | BindingFlags.NonPublic);
            Assert.That(method, Is.Not.Null);
            Assert.That(playerField, Is.Not.Null);
            Assert.That(seekPausedField, Is.Not.Null);

            var gameObject = new GameObject("animation-seek-contract");
            gameObject.SetActive(false);
            AnimationClip clip = null;
            try
            {
                var controller = gameObject.AddComponent<NekoAvatarController>();
                var player = gameObject.AddComponent<Animation>();
                clip = new AnimationClip { legacy = true };
                player.AddClip(clip, "seek-contract");
                playerField.SetValue(controller, player);

                method.Invoke(controller, new object[] { 0f, true });
                Assert.That((bool)seekPausedField.GetValue(controller), Is.True);
                Assert.That(player.enabled, Is.False);

                method.Invoke(controller, new object[] { 0f, false });
                Assert.That((bool)seekPausedField.GetValue(controller), Is.False);
                Assert.That(player.enabled, Is.True);
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(gameObject);
                if (clip != null) UnityEngine.Object.DestroyImmediate(clip);
            }
        }

        [Test]
        public void MovementAnimationKeepsRotationsButRemovesAuthoredHipsTranslation()
        {
            var providerType = typeof(NekoAvatarController).GetNestedType(
                "RootTranslationFilteredPoseProvider",
                BindingFlags.NonPublic);
            Assert.That(providerType, Is.Not.Null);
            var source = new StubPoseProvider();
            var provider = (INormalizedPoseProvider)Activator.CreateInstance(
                providerType,
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                null,
                new object[] { source, new StubTPoseProvider() },
                null);

            Assert.That(provider.GetRawHipsPosition(), Is.EqualTo(new Vector3(1f, 2f, 3f)));
            Assert.That(
                provider.GetNormalizedLocalRotation(HumanBodyBones.Head, HumanBodyBones.Neck),
                Is.EqualTo(source.Rotation));
        }

        [Test]
        public void AnimationBlendMatchesThreeWeightAccumulationAndRestPoseFill()
        {
            var accumulated = Quaternion.identity;
            var weight = 0f;
            accumulated = NekoAvatarProtocol.AccumulateAnimationRotation(
                accumulated,
                weight,
                Quaternion.AngleAxis(0f, Vector3.up),
                0.5f,
                out weight);
            accumulated = NekoAvatarProtocol.AccumulateAnimationRotation(
                accumulated,
                weight,
                Quaternion.AngleAxis(90f, Vector3.up),
                0.5f,
                out weight);
            var blended = NekoAvatarProtocol.FinalizeAnimationRotation(accumulated, weight);
            Assert.That(
                Quaternion.Angle(blended, Quaternion.AngleAxis(45f, Vector3.up)),
                Is.Zero.Within(0.001f));

            float partialWeight;
            var partialRotation = NekoAvatarProtocol.AccumulateAnimationRotation(
                Quaternion.identity,
                0f,
                Quaternion.AngleAxis(90f, Vector3.up),
                0.25f,
                out partialWeight);
            partialRotation = NekoAvatarProtocol.FinalizeAnimationRotation(partialRotation, partialWeight);
            Assert.That(
                Quaternion.Angle(partialRotation, Quaternion.AngleAxis(22.5f, Vector3.up)),
                Is.Zero.Within(0.001f));
        }

        [Test]
        public void AnimationBlendNormalizesHipsAcrossDifferentSourceTPoseHeights()
        {
            var reference = new Vector3(0f, 4f, 0f);
            var normalized = NekoAvatarProtocol.RetargetAnimationHipsToReference(
                new Vector3(1f, 3f, 3f),
                new Vector3(0f, 2f, 0f),
                reference);
            Assert.That(normalized, Is.EqualTo(new Vector3(2f, 6f, 6f)));

            float weight;
            var partialHips = NekoAvatarProtocol.AccumulateAnimationVector(
                reference,
                0f,
                normalized,
                0.5f,
                out weight);
            partialHips = NekoAvatarProtocol.FinalizeAnimationVector(partialHips, weight, reference);
            Assert.That(partialHips, Is.EqualTo(new Vector3(1f, 5f, 3f)));

            var zeroHeight = NekoAvatarProtocol.RetargetAnimationHipsToReference(
                new Vector3(1f, 1f, 1f),
                Vector3.zero,
                reference);
            Assert.That(NekoAvatarProtocol.IsFiniteVector(zeroHeight), Is.True);
            Assert.That(zeroHeight, Is.EqualTo(new Vector3(1f, 5f, 1f)));
        }

        [Test]
        public void RepeatedAnimationTransitionsKeepTheTotalLayerWeightStable()
        {
            var first = NekoAvatarProtocol.CalculateAnimationBlendWeight(1f, 0f, 0.5f, 1f);
            var second = NekoAvatarProtocol.CalculateAnimationBlendWeight(0f, 1f, 0.5f, 1f);
            Assert.That(first + second, Is.EqualTo(1f).Within(0.0001f));

            first = NekoAvatarProtocol.CalculateAnimationBlendWeight(first, 0f, 0.5f, 1f);
            second = NekoAvatarProtocol.CalculateAnimationBlendWeight(second, 0f, 0.5f, 1f);
            var third = NekoAvatarProtocol.CalculateAnimationBlendWeight(0f, 1f, 0.5f, 1f);
            Assert.That(first, Is.EqualTo(0.25f).Within(0.0001f));
            Assert.That(second, Is.EqualTo(0.25f).Within(0.0001f));
            Assert.That(third, Is.EqualTo(0.5f).Within(0.0001f));
            Assert.That(first + second + third, Is.EqualTo(1f).Within(0.0001f));
        }

        [Test]
        public void LayeredAnimationRestoresExpressionOriginalAndUsesAStableReferenceTPose()
        {
            var layerType = typeof(NekoAvatarController).GetNestedType(
                "AnimationLayer",
                BindingFlags.NonPublic);
            var layeredType = typeof(NekoAvatarController).GetNestedType(
                "LayeredVrmAnimation",
                BindingFlags.NonPublic);
            Assert.That(layerType, Is.Not.Null);
            Assert.That(layeredType, Is.Not.Null);

            var firstBridge = new StubVrmAnimation(
                Quaternion.identity,
                new Vector3(0f, 3f, 0f),
                new Vector3(0f, 2f, 0f),
                ExpressionKey.Happy,
                1f);
            var secondBridge = new StubVrmAnimation(
                Quaternion.AngleAxis(90f, Vector3.up),
                new Vector3(0f, 6f, 0f),
                new Vector3(0f, 4f, 0f));
            var firstLayer = Activator.CreateInstance(
                layerType,
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                null,
                new object[] { null, firstBridge, null, 0.5f },
                null);
            var secondLayer = Activator.CreateInstance(
                layerType,
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                null,
                new object[] { null, secondBridge, null, 0.5f },
                null);
            var expressionOriginal = 0.4f;
            Func<ExpressionKey, float> getExpressionOriginal = key => expressionOriginal;
            var layered = Activator.CreateInstance(
                layeredType,
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                null,
                new object[] { null, getExpressionOriginal },
                null);
            var add = layeredType.GetMethod("Add", BindingFlags.Instance | BindingFlags.Public);
            add.Invoke(layered, new[] { firstLayer });
            add.Invoke(layered, new[] { secondLayer });

            var animation = (IVrm10Animation)layered;
            var rig = animation.ControlRig;
            Assert.That(
                Quaternion.Angle(
                    rig.Item1.GetNormalizedLocalRotation(HumanBodyBones.Head, HumanBodyBones.Neck),
                    Quaternion.AngleAxis(45f, Vector3.up)),
                Is.Zero.Within(0.001f));
            Assert.That(rig.Item1.GetRawHipsPosition(), Is.EqualTo(new Vector3(0f, 3f, 0f)));
            Assert.That(rig.Item2.GetWorldTransform(HumanBodyBones.Hips).Value.Translation,
                Is.EqualTo(new Vector3(0f, 2f, 0f)));
            Assert.That(animation.ExpressionMap[ExpressionKey.Happy](), Is.EqualTo(0.7f).Within(0.0001f));

            layeredType.GetMethod("FadeExistingToZero", BindingFlags.Instance | BindingFlags.Public)
                .Invoke(layered, new object[] { 0f });
            Assert.That(
                Quaternion.Angle(
                    rig.Item1.GetNormalizedLocalRotation(HumanBodyBones.Head, HumanBodyBones.Neck),
                    Quaternion.identity),
                Is.Zero.Within(0.001f));
            Assert.That(rig.Item1.GetRawHipsPosition(), Is.EqualTo(new Vector3(0f, 2f, 0f)));
            Assert.That(animation.ExpressionMap[ExpressionKey.Happy](), Is.EqualTo(0.4f).Within(0.0001f));
            var retiredListType = typeof(List<>).MakeGenericType(layerType);
            var retired = Activator.CreateInstance(retiredListType);
            layeredType.GetMethod("Advance", BindingFlags.Instance | BindingFlags.Public)
                .Invoke(layered, new[] { (object)0f, retired });

            Assert.That(animation.ExpressionMap.ContainsKey(ExpressionKey.Happy), Is.False);
            expressionOriginal = 0.8f;
            var reactivatedLayer = Activator.CreateInstance(
                layerType,
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                null,
                new object[] { null, firstBridge, null, 0.5f },
                null);
            add.Invoke(layered, new[] { reactivatedLayer });
            Assert.That(animation.ExpressionMap[ExpressionKey.Happy](), Is.EqualTo(0.9f).Within(0.0001f));
            Assert.That(
                NekoAvatarProtocol.FinalizeAnimationScalar(0.5f, 0.5f, 0.4f),
                Is.EqualTo(0.7f).Within(0.0001f));
            Assert.That(NekoAvatarProtocol.FinalizeAnimationScalar(1.6f, 2f), Is.EqualTo(0.8f).Within(0.0001f));
        }

        [Test]
        public void StopPoseRestoreUsesReferenceHipsAndIdentityRotations()
        {
            var target = new StubReferencePoseTarget();
            var restore = typeof(NekoAvatarController).GetMethod(
                "RestoreAnimationReferencePose",
                BindingFlags.Static | BindingFlags.NonPublic);
            Assert.That(restore, Is.Not.Null);

            restore.Invoke(null, new object[] { target, target });

            Assert.That(target.Hips, Is.EqualTo(new Vector3(0f, 2f, 0f)));
            Assert.That(
                Quaternion.Angle(target.HipsRotation, Quaternion.identity),
                Is.Zero.Within(0.001f));
        }

        [Test]
        public void AnimationBlendKeepsMouthAndBlinkOwnedByLiveInput()
        {
            var animationObject = new GameObject("filtered-animation-contract");
            animationObject.SetActive(false);
            try
            {
                var source = animationObject.AddComponent<Vrm10AnimationInstance>();
                source.ControlRig = (new StubPoseProvider(), new StubTPoseProvider());
                var mapField = typeof(Vrm10AnimationInstance).GetField(
                    "_ExpressionGetterMap",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                Assert.That(mapField, Is.Not.Null);
                var map = (IDictionary<ExpressionKey, Func<float>>)mapField.GetValue(source);
                map.Add(ExpressionKey.Happy, () => 0.8f);
                map.Add(ExpressionKey.Aa, () => 0.6f);
                map.Add(ExpressionKey.Blink, () => 0.4f);

                var filteredType = typeof(NekoAvatarController).GetNestedType(
                    "FilteredVrmAnimation",
                    BindingFlags.NonPublic);
                var filtered = (IVrm10Animation)Activator.CreateInstance(
                    filteredType,
                    BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                    null,
                    new object[] { source, false },
                    null);

                Assert.That(filtered.ExpressionMap.ContainsKey(ExpressionKey.Happy), Is.True);
                Assert.That(filtered.ExpressionMap.ContainsKey(ExpressionKey.Aa), Is.False);
                Assert.That(filtered.ExpressionMap.ContainsKey(ExpressionKey.Blink), Is.False);
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(animationObject);
            }
        }

        [Test]
        public void GlobalPauseFreezesAllLayersWhileSeekPauseOnlyFreezesTheActiveLayer()
        {
            var controllerObject = new GameObject("layer-pause-controller");
            var firstObject = new GameObject("layer-pause-first");
            var secondObject = new GameObject("layer-pause-second");
            controllerObject.SetActive(false);
            firstObject.SetActive(false);
            secondObject.SetActive(false);
            AnimationClip firstClip = null;
            AnimationClip secondClip = null;
            try
            {
                var camera = controllerObject.AddComponent<Camera>();
                var controller = controllerObject.AddComponent<NekoAvatarController>();
                var firstPlayer = firstObject.AddComponent<Animation>();
                var secondPlayer = secondObject.AddComponent<Animation>();
                firstClip = new AnimationClip { legacy = true };
                secondClip = new AnimationClip { legacy = true };
                firstPlayer.AddClip(firstClip, "first");
                secondPlayer.AddClip(secondClip, "second");

                var layerType = typeof(NekoAvatarController).GetNestedType(
                    "AnimationLayer",
                    BindingFlags.NonPublic);
                var layeredType = typeof(NekoAvatarController).GetNestedType(
                    "LayeredVrmAnimation",
                    BindingFlags.NonPublic);
                var bridge = new StubVrmAnimation(
                    Quaternion.identity,
                    new Vector3(0f, 2f, 0f),
                    new Vector3(0f, 2f, 0f));
                var firstLayer = Activator.CreateInstance(
                    layerType,
                    BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                    null,
                    new object[] { null, bridge, firstPlayer, 0.5f },
                    null);
                var secondLayer = Activator.CreateInstance(
                    layerType,
                    BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                    null,
                    new object[] { null, bridge, secondPlayer, 0.5f },
                    null);
                var layered = Activator.CreateInstance(layeredType, true);
                var add = layeredType.GetMethod("Add", BindingFlags.Instance | BindingFlags.Public);
                add.Invoke(layered, new[] { firstLayer });
                add.Invoke(layered, new[] { secondLayer });

                typeof(NekoAvatarController).GetField(
                    "_layeredAnimation",
                    BindingFlags.Instance | BindingFlags.NonPublic).SetValue(controller, layered);
                typeof(NekoAvatarController).GetField(
                    "_activeAnimationLayer",
                    BindingFlags.Instance | BindingFlags.NonPublic).SetValue(controller, secondLayer);
                typeof(NekoAvatarController).GetField(
                    "_animationPlayer",
                    BindingFlags.Instance | BindingFlags.NonPublic).SetValue(controller, secondPlayer);
                typeof(NekoAvatarController).GetField(
                    "_camera",
                    BindingFlags.Instance | BindingFlags.NonPublic).SetValue(controller, camera);

                var setPaused = typeof(NekoAvatarController).GetMethod(
                    "SetPaused",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                setPaused.Invoke(controller, new object[] { true });
                Assert.That(firstPlayer.enabled, Is.False);
                Assert.That(secondPlayer.enabled, Is.False);
                setPaused.Invoke(controller, new object[] { false });
                Assert.That(firstPlayer.enabled, Is.True);
                Assert.That(secondPlayer.enabled, Is.True);

                var seek = typeof(NekoAvatarController).GetMethod(
                    "SeekAnimation",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                seek.Invoke(controller, new object[] { 0f, true });
                Assert.That(firstPlayer.enabled, Is.True);
                Assert.That(secondPlayer.enabled, Is.False);
                seek.Invoke(controller, new object[] { 0f, false });
                Assert.That(firstPlayer.enabled, Is.True);
                Assert.That(secondPlayer.enabled, Is.True);

                var release = typeof(NekoAvatarController).GetMethod(
                    "ReleaseAnimation",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                release.Invoke(controller, null);
                release.Invoke(controller, null);
                Assert.That((bool)layerType.GetField("Released").GetValue(firstLayer), Is.True);
                Assert.That((bool)layerType.GetField("Released").GetValue(secondLayer), Is.True);
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(controllerObject);
                UnityEngine.Object.DestroyImmediate(firstObject);
                UnityEngine.Object.DestroyImmediate(secondObject);
                if (firstClip != null) UnityEngine.Object.DestroyImmediate(firstClip);
                if (secondClip != null) UnityEngine.Object.DestroyImmediate(secondClip);
            }
        }

        [Test]
        public void StopFadesEveryLayerAndAPendingActionReusesTheOutgoingMixer()
        {
            var controllerObject = new GameObject("layer-stop-controller");
            var firstObject = new GameObject("layer-stop-first");
            var secondObject = new GameObject("layer-stop-second");
            var thirdObject = new GameObject("layer-stop-third");
            controllerObject.SetActive(false);
            firstObject.SetActive(false);
            secondObject.SetActive(false);
            thirdObject.SetActive(false);
            try
            {
                var controller = controllerObject.AddComponent<NekoAvatarController>();
                var firstPlayer = firstObject.AddComponent<Animation>();
                var secondPlayer = secondObject.AddComponent<Animation>();
                var thirdPlayer = thirdObject.AddComponent<Animation>();
                var controllerType = typeof(NekoAvatarController);
                var layerType = controllerType.GetNestedType("AnimationLayer", BindingFlags.NonPublic);
                var layeredType = controllerType.GetNestedType("LayeredVrmAnimation", BindingFlags.NonPublic);
                var bridge = new StubVrmAnimation(
                    Quaternion.identity,
                    new Vector3(0f, 2f, 0f),
                    new Vector3(0f, 2f, 0f));
                var firstLayer = Activator.CreateInstance(
                    layerType,
                    BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                    null,
                    new object[] { null, bridge, firstPlayer, 0.5f },
                    null);
                var secondLayer = Activator.CreateInstance(
                    layerType,
                    BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                    null,
                    new object[] { null, bridge, secondPlayer, 0.5f },
                    null);
                var layered = Activator.CreateInstance(layeredType, true);
                var add = layeredType.GetMethod("Add", BindingFlags.Instance | BindingFlags.Public);
                add.Invoke(layered, new[] { firstLayer });
                add.Invoke(layered, new[] { secondLayer });

                var layeredField = controllerType.GetField(
                    "_layeredAnimation",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                var activeLayerField = controllerType.GetField(
                    "_activeAnimationLayer",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                var playerField = controllerType.GetField(
                    "_animationPlayer",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                var actionIdField = controllerType.GetField(
                    "_animationActionId",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                var wasPlayingField = controllerType.GetField(
                    "_animationWasPlaying",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                var revisionField = controllerType.GetField(
                    "_animationRevision",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                var pendingIdField = controllerType.GetField(
                    "_animationPendingId",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                layeredField.SetValue(controller, layered);
                activeLayerField.SetValue(controller, secondLayer);
                playerField.SetValue(controller, secondPlayer);
                actionIdField.SetValue(controller, "walk");
                wasPlayingField.SetValue(controller, true);
                revisionField.SetValue(controller, 5);
                pendingIdField.SetValue(controller, "pending-dance");

                var stop = controllerType.GetMethod(
                    "StopAnimation",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                var advance = controllerType.GetMethod(
                    "AdvanceAnimationBlend",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                var install = controllerType.GetMethod(
                    "InstallAnimationLayer",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                stop.Invoke(controller, new[]
                {
                    ParseCommandEnvelope(
                        "{\"v\":1,\"generation\":1,\"command\":\"animation.stop\","
                        + "\"body\":{\"actionId\":\"walk\",\"preservePending\":true}}")
                });

                Assert.That(revisionField.GetValue(controller), Is.EqualTo(5));
                Assert.That(pendingIdField.GetValue(controller), Is.EqualTo("pending-dance"));
                Assert.That(activeLayerField.GetValue(controller), Is.Null);
                Assert.That(playerField.GetValue(controller), Is.Null);
                Assert.That((bool)wasPlayingField.GetValue(controller), Is.False);
                Assert.That((bool)layerType.GetField("Released").GetValue(firstLayer), Is.False);
                Assert.That((bool)layerType.GetField("Released").GetValue(secondLayer), Is.False);

                advance.Invoke(controller, new object[] { 0.25f });
                var weight = layerType.GetProperty("Weight", BindingFlags.Instance | BindingFlags.Public);
                Assert.That((float)weight.GetValue(firstLayer), Is.EqualTo(0.25f).Within(0.0001f));
                Assert.That((float)weight.GetValue(secondLayer), Is.EqualTo(0.25f).Within(0.0001f));

                var thirdLayer = Activator.CreateInstance(
                    layerType,
                    BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                    null,
                    new object[] { null, bridge, thirdPlayer, 0f },
                    null);
                install.Invoke(controller, new[] { thirdLayer, (object)false, 0.5f });
                Assert.That(layeredField.GetValue(controller), Is.SameAs(layered));
                activeLayerField.SetValue(controller, thirdLayer);
                playerField.SetValue(controller, thirdPlayer);
                actionIdField.SetValue(controller, "dance");
                wasPlayingField.SetValue(controller, true);

                advance.Invoke(controller, new object[] { 0.5f });
                Assert.That((bool)layerType.GetField("Released").GetValue(firstLayer), Is.True);
                Assert.That((bool)layerType.GetField("Released").GetValue(secondLayer), Is.True);
                Assert.That((bool)layerType.GetField("Released").GetValue(thirdLayer), Is.False);
                Assert.That((float)weight.GetValue(thirdLayer), Is.EqualTo(1f).Within(0.0001f));

                pendingIdField.SetValue(controller, null);
                stop.Invoke(controller, new[]
                {
                    ParseCommandEnvelope(
                        "{\"v\":1,\"generation\":1,\"command\":\"animation.stop\",\"body\":{}}")
                });
                Assert.That(revisionField.GetValue(controller), Is.EqualTo(6));
                advance.Invoke(controller, new object[] { 0.5f });
                Assert.That((bool)layerType.GetField("Released").GetValue(thirdLayer), Is.True);
                Assert.That(layeredField.GetValue(controller), Is.Null);
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(controllerObject);
                UnityEngine.Object.DestroyImmediate(firstObject);
                UnityEngine.Object.DestroyImmediate(secondObject);
                UnityEngine.Object.DestroyImmediate(thirdObject);
            }
        }

        [Test]
        public void StopReleasesASeekPausedAnimationImmediately()
        {
            var controllerObject = new GameObject("paused-layer-stop-controller");
            var playerObject = new GameObject("paused-layer-stop-player");
            controllerObject.SetActive(false);
            playerObject.SetActive(false);
            try
            {
                var controller = controllerObject.AddComponent<NekoAvatarController>();
                var player = playerObject.AddComponent<Animation>();
                var controllerType = typeof(NekoAvatarController);
                var layerType = controllerType.GetNestedType("AnimationLayer", BindingFlags.NonPublic);
                var layeredType = controllerType.GetNestedType("LayeredVrmAnimation", BindingFlags.NonPublic);
                var bridge = new StubVrmAnimation(
                    Quaternion.identity,
                    new Vector3(0f, 2f, 0f),
                    new Vector3(0f, 2f, 0f));
                var layer = Activator.CreateInstance(
                    layerType,
                    BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                    null,
                    new object[] { null, bridge, player, 1f },
                    null);
                var layered = Activator.CreateInstance(layeredType, true);
                layeredType.GetMethod("Add", BindingFlags.Instance | BindingFlags.Public)
                    .Invoke(layered, new[] { layer });

                controllerType.GetField("_layeredAnimation", BindingFlags.Instance | BindingFlags.NonPublic)
                    .SetValue(controller, layered);
                controllerType.GetField("_activeAnimationLayer", BindingFlags.Instance | BindingFlags.NonPublic)
                    .SetValue(controller, layer);
                controllerType.GetField("_animationPlayer", BindingFlags.Instance | BindingFlags.NonPublic)
                    .SetValue(controller, player);
                controllerType.GetField("_animationActionId", BindingFlags.Instance | BindingFlags.NonPublic)
                    .SetValue(controller, "paused");
                controllerType.GetField("_animationSeekPaused", BindingFlags.Instance | BindingFlags.NonPublic)
                    .SetValue(controller, true);

                controllerType.GetMethod("StopAnimation", BindingFlags.Instance | BindingFlags.NonPublic)
                    .Invoke(controller, new[]
                    {
                        ParseCommandEnvelope(
                            "{\"v\":1,\"generation\":1,\"command\":\"animation.stop\","
                            + "\"body\":{\"actionId\":\"paused\",\"preservePending\":true}}")
                    });

                Assert.That((bool)layerType.GetField("Released").GetValue(layer), Is.True);
                Assert.That(
                    controllerType.GetField("_layeredAnimation", BindingFlags.Instance | BindingFlags.NonPublic)
                        .GetValue(controller),
                    Is.Null);
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(controllerObject);
                UnityEngine.Object.DestroyImmediate(playerObject);
            }
        }

        [Test]
        public void BatchExpressionAndAnimationFieldsParseFromTheBrowserEnvelope()
        {
            var envelopeType = typeof(NekoAvatarController).GetNestedType("CommandEnvelope", BindingFlags.NonPublic);
            Assert.That(envelopeType, Is.Not.Null);
            var json = "{\"v\":1,\"id\":\"contract\",\"generation\":7,\"command\":\"expression.setWeights\","
                + "\"body\":{\"weights\":[{\"name\":\"happy\",\"value\":0.75}],"
                + "\"timeScale\":0.9,\"fadeDuration\":0.4,\"movement\":true,\"paused\":true,\"actionId\":\"walk-7\","
                + "\"awaitInitialAnimation\":true,\"visible\":true,"
                + "\"preservePending\":true,\"quality\":\"high\",\"mode\":\"height\","
                + "\"align\":\"bottom-center\",\"padding\":6,\"scaleMultiplier\":0.8,"
                + "\"autoScale\":true,\"minWidth\":80,\"minHeight\":120,"
                + "\"viewScale\":260,\"viewX\":10,\"viewY\":-5,\"factor\":1.25}}";
            var envelope = ParseCommandEnvelope(json);
            var body = envelopeType.GetField("body").GetValue(envelope);
            var bodyType = body.GetType();
            var weights = (Array)bodyType.GetField("weights").GetValue(body);
            var first = weights.GetValue(0);

            Assert.That(weights.Length, Is.EqualTo(1));
            Assert.That(first.GetType().GetField("name").GetValue(first), Is.EqualTo("happy"));
            Assert.That((float)first.GetType().GetField("value").GetValue(first), Is.EqualTo(0.75f));
            Assert.That((float)bodyType.GetField("timeScale").GetValue(body), Is.EqualTo(0.9f));
            Assert.That((float)bodyType.GetField("fadeDuration").GetValue(body), Is.EqualTo(0.4f));
            Assert.That((bool)bodyType.GetField("movement").GetValue(body), Is.True);
            Assert.That((bool)bodyType.GetField("paused").GetValue(body), Is.True);
            Assert.That((bool)bodyType.GetField("awaitInitialAnimation").GetValue(body), Is.True);
            Assert.That((bool)bodyType.GetField("visible").GetValue(body), Is.True);
            Assert.That(bodyType.GetField("actionId").GetValue(body), Is.EqualTo("walk-7"));
            Assert.That((bool)bodyType.GetField("preservePending").GetValue(body), Is.True);
            Assert.That(bodyType.GetField("quality").GetValue(body), Is.EqualTo("high"));
            Assert.That((int)bodyType.GetField("targetFrameRate").GetValue(body), Is.EqualTo(-1));
            Assert.That(bodyType.GetField("mode").GetValue(body), Is.EqualTo("height"));
            Assert.That(bodyType.GetField("align").GetValue(body), Is.EqualTo("bottom-center"));
            Assert.That((float)bodyType.GetField("viewScale").GetValue(body), Is.EqualTo(260f));
            Assert.That((float)bodyType.GetField("viewX").GetValue(body), Is.EqualTo(10f));
            Assert.That((float)bodyType.GetField("viewY").GetValue(body), Is.EqualTo(-5f));
            Assert.That((float)bodyType.GetField("factor").GetValue(body), Is.EqualTo(1.25f));
            Assert.That(
                (float)bodyType.GetField("minVisiblePixels").GetValue(body),
                Is.EqualTo(NekoAvatarProtocol.DefaultMinVisiblePixels));
            Assert.That((bool)bodyType.GetField("animate").GetValue(body), Is.False);
            Assert.That((bool)bodyType.GetField("clamp").GetValue(body), Is.True);

            var vmcBodyType = typeof(NekoAvatarController).GetNestedType("VmcSnapshotBody", BindingFlags.NonPublic);
            Assert.That(vmcBodyType.GetField("restPose"), Is.Not.Null);
            Assert.That(
                typeof(NekoAvatarController).GetField("_fitReferenceCorners", BindingFlags.Instance | BindingFlags.NonPublic),
                Is.Not.Null);
            Assert.That(
                typeof(NekoAvatarController).GetField("_animationSeekPaused", BindingFlags.Instance | BindingFlags.NonPublic),
                Is.Not.Null);
            Assert.That(NekoAvatarProtocol.InitialAnimationFallbackSeconds, Is.GreaterThan(0f).And.LessThanOrEqualTo(2f));
            Assert.That(NekoAvatarProtocol.InitialAnimationHardFallbackSeconds, Is.GreaterThanOrEqualTo(1f).And.LessThanOrEqualTo(2f));
        }

        [Test]
        public void PoseAccessoryAndAnchorBodiesUseTheGenericBridgeShape()
        {
            var envelopeType = typeof(NekoAvatarController).GetNestedType("CommandEnvelope", BindingFlags.NonPublic);
            var json = "{\"v\":1,\"id\":\"sports\",\"generation\":3,\"command\":\"accessory.attach\","
                + "\"body\":{\"id\":\"racket\",\"preset\":\"badmintonRacket\",\"bone\":\"rightHand\","
                + "\"position\":{\"x\":0.006,\"y\":0.002,\"z\":0.012},"
                + "\"eulerRadians\":{\"x\":0.22,\"y\":-0.12,\"z\":-0.54},"
                + "\"scale\":{\"x\":1.26,\"y\":1.26,\"z\":1.26},"
                + "\"poseId\":\"badminton-player\",\"reset\":true,"
                + "\"rootOffset\":{\"x\":0,\"y\":0.014,\"z\":0},"
                + "\"bones\":[{\"name\":\"hips\",\"eulerRadians\":{\"x\":0.1,\"y\":0,\"z\":0},\"weight\":0.8}],"
                + "\"anchors\":[{\"name\":\"sweetSpot\",\"localPosition\":{\"x\":0,\"y\":0.475,\"z\":0.002}}],"
                + "\"tracks\":[{\"name\":\"racket\",\"accessoryId\":\"racket\",\"anchor\":\"sweetSpot\"}]}}";
            var envelope = ParseCommandEnvelope(json);
            var body = envelopeType.GetField("body").GetValue(envelope);
            var bodyType = body.GetType();
            Assert.That(bodyType.GetField("id").GetValue(body), Is.EqualTo("racket"));
            Assert.That(bodyType.GetField("preset").GetValue(body), Is.EqualTo("badmintonRacket"));
            Assert.That(((Array)bodyType.GetField("bones").GetValue(body)).Length, Is.EqualTo(1));
            Assert.That(((Array)bodyType.GetField("anchors").GetValue(body)).Length, Is.EqualTo(1));
            Assert.That(((Array)bodyType.GetField("tracks").GetValue(body)).Length, Is.EqualTo(1));

            var order = (DefaultExecutionOrder)Attribute.GetCustomAttribute(
                typeof(NekoAvatarController), typeof(DefaultExecutionOrder));
            Assert.That(order, Is.Not.Null);
            Assert.That(order.order, Is.GreaterThan(11000));
            Assert.That(
                typeof(NekoAvatarController).Assembly.GetType("Neko.Avatar.NekoAvatarAccessoryFactory"),
                Is.Not.Null);
        }

        [Test]
        public void PoseRootOffsetComposesWithModelTransformAndMovement()
        {
            var controllerObject = new GameObject("pose-root-controller");
            var avatarObject = new GameObject("pose-root-avatar");
            controllerObject.SetActive(false);
            avatarObject.SetActive(false);
            FieldInfo avatarField = null;
            try
            {
                var controller = controllerObject.AddComponent<NekoAvatarController>();
                var avatar = avatarObject.AddComponent<Vrm10Instance>();
                avatar.transform.position = new Vector3(1f, 2f, 3f);
                avatarField = typeof(NekoAvatarController).GetField(
                    "_avatar",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                avatarField.SetValue(controller, avatar);
                typeof(NekoAvatarController).GetField(
                    "_generation",
                    BindingFlags.Instance | BindingFlags.NonPublic).SetValue(controller, 7);

                LogAssert.Expect(LogType.Log, new Regex("\\[NekoAvatarEvent\\].*pose\\.applied"));
                controller.HandleCommand(
                    "{\"v\":1,\"id\":\"pose\",\"generation\":7,\"command\":\"pose.set\","
                    + "\"body\":{\"poseId\":\"sports\",\"rootOffset\":{\"x\":0,\"y\":0.25,\"z\":0},\"bones\":[]}}");
                Assert.That(avatar.transform.position, Is.EqualTo(new Vector3(1f, 2.25f, 3f)));

                typeof(NekoAvatarController).GetMethod(
                    "SetAvatarModelPosition",
                    BindingFlags.Instance | BindingFlags.NonPublic).Invoke(
                        controller,
                        new object[] { new Vector3(4f, 5f, 6f) });
                Assert.That(avatar.transform.position, Is.EqualTo(new Vector3(4f, 5.25f, 6f)));

                avatar.transform.position += new Vector3(2f, 0f, 0f);
                typeof(NekoAvatarController).GetMethod(
                    "ApplyActivePose",
                    BindingFlags.Instance | BindingFlags.NonPublic).Invoke(controller, null);
                Assert.That(
                    avatar.transform.position,
                    Is.EqualTo(new Vector3(6f, 5.25f, 6f)),
                    "LateUpdate pose application must not overwrite model movement");

                var transform = typeof(NekoAvatarController).GetMethod(
                    "BuildAvatarTransform",
                    BindingFlags.Instance | BindingFlags.NonPublic).Invoke(controller, null);
                var position = transform.GetType().GetField("position").GetValue(transform);
                var positionType = position.GetType();
                Assert.That((float)positionType.GetField("x").GetValue(position), Is.EqualTo(6f));
                Assert.That((float)positionType.GetField("y").GetValue(position), Is.EqualTo(5f));
                Assert.That((float)positionType.GetField("z").GetValue(position), Is.EqualTo(6f));

                LogAssert.Expect(LogType.Log, new Regex("\\[NekoAvatarEvent\\].*pose\\.reset"));
                controller.HandleCommand(
                    "{\"v\":1,\"id\":\"reset\",\"generation\":7,\"command\":\"pose.reset\","
                    + "\"body\":{\"poseId\":\"sports\"}}");
                Assert.That(avatar.transform.position, Is.EqualTo(new Vector3(6f, 5f, 6f)));
                avatarField.SetValue(controller, null);
            }
            finally
            {
                if (avatarField != null)
                {
                    var controller = controllerObject.GetComponent<NekoAvatarController>();
                    if (controller != null) avatarField.SetValue(controller, null);
                }
                UnityEngine.Object.DestroyImmediate(controllerObject);
                UnityEngine.Object.DestroyImmediate(avatarObject);
            }
        }

        [Test]
        public void StaleModelGenerationCannotMutateOrUnloadTheCurrentAvatar()
        {
            var controllerObject = new GameObject("generation-controller");
            var avatarObject = new GameObject("generation-avatar");
            controllerObject.SetActive(false);
            avatarObject.SetActive(false);
            FieldInfo avatarField = null;
            try
            {
                var controller = controllerObject.AddComponent<NekoAvatarController>();
                var avatar = avatarObject.AddComponent<Vrm10Instance>();
                avatar.transform.position = new Vector3(1f, 2f, 3f);
                avatarField = typeof(NekoAvatarController).GetField(
                    "_avatar",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                avatarField.SetValue(controller, avatar);
                var generationField = typeof(NekoAvatarController).GetField(
                    "_generation",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                generationField.SetValue(controller, 9);

                LogAssert.Expect(LogType.Log, new Regex("\\[NekoAvatarEvent\\].*stale_generation"));
                controller.HandleCommand(
                    "{\"v\":1,\"id\":\"old-transform\",\"generation\":8,\"command\":\"model.transform\","
                    + "\"body\":{\"position\":{\"x\":20,\"y\":30,\"z\":40}}}");
                Assert.That(avatar.transform.position, Is.EqualTo(new Vector3(1f, 2f, 3f)));

                LogAssert.Expect(LogType.Log, new Regex("\\[NekoAvatarEvent\\].*stale_generation"));
                controller.HandleCommand(
                    "{\"v\":1,\"id\":\"old-unload\",\"generation\":8,\"command\":\"model.unload\",\"body\":{}}");
                Assert.That(avatarField.GetValue(controller), Is.SameAs(avatar));
                Assert.That((int)generationField.GetValue(controller), Is.EqualTo(9));

                LogAssert.Expect(LogType.Log, new Regex("\\[NekoAvatarEvent\\].*stale_generation"));
                controller.HandleCommand(
                    "{\"v\":1,\"id\":\"old-load\",\"generation\":7,\"command\":\"model.load\","
                    + "\"body\":{\"url\":\"/static/vrm/old.vrm\"}}");
                Assert.That(avatarField.GetValue(controller), Is.SameAs(avatar));
                Assert.That((int)generationField.GetValue(controller), Is.EqualTo(9));
                avatarField.SetValue(controller, null);
            }
            finally
            {
                if (avatarField != null)
                {
                    var controller = controllerObject.GetComponent<NekoAvatarController>();
                    if (controller != null) avatarField.SetValue(controller, null);
                }
                UnityEngine.Object.DestroyImmediate(controllerObject);
                UnityEngine.Object.DestroyImmediate(avatarObject);
            }
        }

        [Test]
        public void SnapCommandParsesItsVisibilityAndAnimationContract()
        {
            var envelopeType = typeof(NekoAvatarController).GetNestedType(
                "CommandEnvelope",
                BindingFlags.NonPublic);
            var envelope = ParseCommandEnvelope(
                "{\"v\":1,\"id\":\"snap\",\"generation\":4,\"command\":\"model.snap\","
                + "\"body\":{\"minVisiblePixels\":240,\"animate\":true}}");
            var body = envelopeType.GetField("body").GetValue(envelope);
            var bodyType = body.GetType();

            Assert.That((float)bodyType.GetField("minVisiblePixels").GetValue(body), Is.EqualTo(240f));
            Assert.That((bool)bodyType.GetField("animate").GetValue(body), Is.True);
            Assert.That(
                typeof(NekoAvatarController).GetMethod(
                    "SnapModelIntoScreen",
                    BindingFlags.Instance | BindingFlags.NonPublic),
                Is.Not.Null);
            Assert.That(NekoAvatarProtocol.ModelOrientationCommand, Is.EqualTo("model.orientation"));
            Assert.That(
                typeof(NekoAvatarController).GetMethod(
                    "ReplyModelOrientation",
                    BindingFlags.Instance | BindingFlags.NonPublic),
                Is.Not.Null);
            var responseType = typeof(NekoAvatarController).GetNestedType(
                "ResponseBody",
                BindingFlags.NonPublic);
            Assert.That(responseType.GetField("moved"), Is.Not.Null);
            Assert.That(responseType.GetField("needsRotation"), Is.Not.Null);
            Assert.That(responseType.GetField("orientationReliable"), Is.Not.Null);
            Assert.That(responseType.GetField("currentRotation"), Is.Not.Null);
            Assert.That(responseType.GetField("suggestedRotation"), Is.Not.Null);

            var unclampedDrag = ParseCommandEnvelope(
                "{\"v\":1,\"id\":\"drag\",\"generation\":4,\"command\":\"model.dragPixels\","
                + "\"body\":{\"dx\":80,\"dy\":40,\"clamp\":false}}");
            var dragBody = envelopeType.GetField("body").GetValue(unclampedDrag);
            Assert.That((bool)dragBody.GetType().GetField("clamp").GetValue(dragBody), Is.False);
        }

        [Test]
        public void OrbitAndGuidedMovementCommandsPreserveTheirRaceKeys()
        {
            var envelopeType = typeof(NekoAvatarController).GetNestedType(
                "CommandEnvelope",
                BindingFlags.NonPublic);
            var orbit = ParseCommandEnvelope(
                "{\"v\":1,\"id\":\"orbit-command\",\"generation\":8,\"command\":\"model.orbit\","
                + "\"body\":{\"phase\":\"update\",\"interactionId\":\"orbit-8\",\"x\":410,\"y\":220}}");
            var orbitBody = envelopeType.GetField("body").GetValue(orbit);
            var bodyType = orbitBody.GetType();
            Assert.That(bodyType.GetField("phase").GetValue(orbitBody), Is.EqualTo("update"));
            Assert.That(bodyType.GetField("interactionId").GetValue(orbitBody), Is.EqualTo("orbit-8"));
            Assert.That((float)bodyType.GetField("x").GetValue(orbitBody), Is.EqualTo(410f));
            Assert.That((float)bodyType.GetField("y").GetValue(orbitBody), Is.EqualTo(220f));

            var movement = ParseCommandEnvelope(
                "{\"v\":1,\"id\":\"move-command\",\"generation\":8,\"command\":\"model.moveToScreen\","
                + "\"body\":{\"actionId\":\"move-8\",\"x\":120,\"y\":90,\"maxSpeed\":0.55,"
                + "\"acceleration\":1.8,\"deceleration\":3.6,\"arrival\":0.02,\"minVisiblePixels\":160}}");
            var movementBody = envelopeType.GetField("body").GetValue(movement);
            Assert.That(bodyType.GetField("actionId").GetValue(movementBody), Is.EqualTo("move-8"));
            Assert.That((float)bodyType.GetField("maxSpeed").GetValue(movementBody), Is.EqualTo(0.55f));
            Assert.That((float)bodyType.GetField("acceleration").GetValue(movementBody), Is.EqualTo(1.8f));
            Assert.That((float)bodyType.GetField("deceleration").GetValue(movementBody), Is.EqualTo(3.6f));
            Assert.That((float)bodyType.GetField("arrival").GetValue(movementBody), Is.EqualTo(0.02f));
            Assert.That((float)bodyType.GetField("minVisiblePixels").GetValue(movementBody), Is.EqualTo(160f));

            var movementWithDefaults = ParseCommandEnvelope(
                "{\"v\":1,\"id\":\"move-default\",\"generation\":8,\"command\":\"model.moveToScreen\","
                + "\"body\":{\"actionId\":\"move-default\",\"x\":20,\"y\":30}}");
            var defaultBody = envelopeType.GetField("body").GetValue(movementWithDefaults);
            Assert.That((float)bodyType.GetField("maxSpeed").GetValue(defaultBody), Is.EqualTo(0.9f));
            Assert.That((float)bodyType.GetField("acceleration").GetValue(defaultBody), Is.EqualTo(2.8f));
            Assert.That((float)bodyType.GetField("deceleration").GetValue(defaultBody), Is.EqualTo(4.2f));
            Assert.That((float)bodyType.GetField("arrival").GetValue(defaultBody), Is.EqualTo(0.012f));
            Assert.That(
                (float)bodyType.GetField("minVisiblePixels").GetValue(defaultBody),
                Is.EqualTo(NekoAvatarProtocol.DefaultMinVisiblePixels));

            Assert.That(
                typeof(NekoAvatarController).GetMethod(
                    "HandleModelOrbit",
                    BindingFlags.Instance | BindingFlags.NonPublic),
                Is.Not.Null);
            Assert.That(
                typeof(NekoAvatarController).GetMethod(
                    "BeginGuidedMovement",
                    BindingFlags.Instance | BindingFlags.NonPublic),
                Is.Not.Null);
            Assert.That(
                typeof(NekoAvatarController).GetMethod(
                    "CancelGuidedMovementCommand",
                    BindingFlags.Instance | BindingFlags.NonPublic),
                Is.Not.Null);
            var movementStateType = typeof(NekoAvatarController).GetNestedType(
                "GuidedMovementState",
                BindingFlags.NonPublic);
            Assert.That(movementStateType.GetField("Acceleration"), Is.Not.Null);
            Assert.That(movementStateType.GetField("Deceleration"), Is.Not.Null);
            Assert.That(movementStateType.GetField("ArrivalThreshold"), Is.Not.Null);
            Assert.That(movementStateType.GetField("MinVisiblePixels"), Is.Not.Null);
        }

        [Test]
        public void ModelProfileCountsOnlyConcreteUnitySceneResources()
        {
            var root = new GameObject("profile-contract");
            root.SetActive(false);
            Mesh mesh = null;
            Material material = null;
            Texture2D texture = null;
            try
            {
                var avatar = root.AddComponent<Vrm10Instance>();

                mesh = new Mesh { name = "profile-mesh" };
                mesh.vertices = new[]
                {
                    Vector3.zero,
                    Vector3.right,
                    Vector3.up,
                    Vector3.one
                };
                mesh.triangles = new[] { 0, 1, 2, 1, 3, 2 };
                var blendShapeDeltas = new Vector3[4];
                mesh.AddBlendShapeFrame(
                    "Smile",
                    100f,
                    blendShapeDeltas,
                    blendShapeDeltas,
                    blendShapeDeltas);

                var shader = Shader.Find("Unlit/Texture") ?? Shader.Find("Standard");
                Assert.That(shader, Is.Not.Null, "A built-in shader is required for the material contract test");
                material = new Material(shader) { name = "profile-material" };
                texture = new Texture2D(1, 1) { name = "profile-texture" };
                material.mainTexture = texture;

                var staticMesh = new GameObject("static-mesh");
                staticMesh.transform.SetParent(root.transform, false);
                staticMesh.AddComponent<MeshFilter>().sharedMesh = mesh;
                staticMesh.AddComponent<MeshRenderer>().sharedMaterial = material;

                var bone = new GameObject("bone").transform;
                bone.SetParent(root.transform, false);
                var skinnedObject = new GameObject("skinned-mesh");
                skinnedObject.transform.SetParent(root.transform, false);
                var skinned = skinnedObject.AddComponent<SkinnedMeshRenderer>();
                skinned.sharedMesh = mesh;
                skinned.sharedMaterial = material;
                skinned.bones = new[] { bone };

                var jointObject = new GameObject("spring-joint");
                jointObject.transform.SetParent(root.transform, false);
                var joint = jointObject.AddComponent<VRM10SpringBoneJoint>();
                var spring = new Vrm10InstanceSpringBone.Spring("hair");
                spring.Joints.Add(joint);
                avatar.SpringBone.Springs.Add(spring);

                var colliderObject = new GameObject("spring-collider");
                colliderObject.transform.SetParent(root.transform, false);
                var collider = colliderObject.AddComponent<VRM10SpringBoneCollider>();
                var groupObject = new GameObject("spring-collider-group");
                groupObject.transform.SetParent(root.transform, false);
                var group = groupObject.AddComponent<VRM10SpringBoneColliderGroup>();
                group.Colliders.Add(collider);
                avatar.SpringBone.ColliderGroups.Add(group);

                var profile = NekoAvatarProfiler.Capture(avatar, "/models/profile.vrm", 320f, 480f);

                Assert.That(profile.type, Is.EqualTo("vrm"));
                Assert.That(profile.loaded, Is.True);
                Assert.That(profile.name, Is.EqualTo("/models/profile.vrm"));
                Assert.That(profile.geometry.meshCount, Is.EqualTo(1));
                Assert.That(profile.geometry.vertices, Is.EqualTo(4));
                Assert.That(profile.geometry.faces, Is.EqualTo(2));
                Assert.That(profile.geometry.morphTargetCount, Is.EqualTo(1));
                Assert.That(profile.materials.count, Is.EqualTo(1));
                Assert.That(profile.materials.textureCount, Is.EqualTo(1));
                Assert.That(profile.skeleton.boneCount, Is.EqualTo(1));
                Assert.That(profile.skeleton.humanBoneCount, Is.Zero);
                Assert.That(profile.springBones.springCount, Is.EqualTo(1));
                Assert.That(profile.springBones.jointCount, Is.EqualTo(1));
                Assert.That(profile.springBones.colliderGroupCount, Is.EqualTo(1));
                Assert.That(profile.springBones.colliderCount, Is.EqualTo(1));
                Assert.That(profile.renderer.rendererCount, Is.EqualTo(2));
                Assert.That(profile.renderer.materialSlotCount, Is.EqualTo(2));
                Assert.That(profile.renderer.drawCalls, Is.GreaterThanOrEqualTo(2));
                Assert.That(profile.renderer.drawCallsEstimated, Is.True);
                Assert.That(
                    profile.renderer.drawCallEstimateMethod,
                    Is.EqualTo(NekoAvatarProfiler.DrawCallEstimateMethod));
                Assert.That(profile.renderer.triangles, Is.EqualTo(2));
                Assert.That(profile.renderer.size.width, Is.EqualTo(320f));
                Assert.That(profile.renderer.size.height, Is.EqualTo(480f));

                var json = JsonUtility.ToJson(profile);
                Assert.That(json, Does.Not.Contain("gpu"));
                Assert.That(json, Does.Not.Contain("rendererInfo"));
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(root);
                if (mesh != null) UnityEngine.Object.DestroyImmediate(mesh);
                if (material != null) UnityEngine.Object.DestroyImmediate(material);
                if (texture != null) UnityEngine.Object.DestroyImmediate(texture);
            }
        }
    }
}
