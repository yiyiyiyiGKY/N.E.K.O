using UnityEngine;

namespace Neko.Avatar
{
    /// <summary>
    /// Built-in Pipeline image effect matching the tone-mapping modes exposed by
    /// Three.js r180. The effect is deliberately disabled for No/Custom mapping,
    /// because Three applies neither tone mapping nor exposure in those modes.
    /// </summary>
    [DisallowMultipleComponent]
    [RequireComponent(typeof(Camera))]
    public sealed class NekoAvatarToneMappingEffect : MonoBehaviour
    {
        public const string ShaderName = "Hidden/Neko/ThreeToneMapping";

        private static readonly int ModeProperty = Shader.PropertyToID("_Mode");
        private static readonly int ExposureProperty = Shader.PropertyToID("_Exposure");

        [SerializeField] private int _mode = 7;
        [SerializeField] private float _exposure = 1.1f;

        private Camera _camera;
        private Material _material;
        private bool _shaderErrorReported;

        public int Mode => _mode;
        public float Exposure => _exposure;
        public bool IsToneMappingActive => UsesToneMapping(_mode);

        public void Configure(float mode, float exposure)
        {
            _mode = NormalizeMode(mode);
            _exposure = NormalizeExposure(exposure);
            EnsureCamera();
            _camera.allowHDR = UsesToneMapping(_mode);
            enabled = UsesToneMapping(_mode);
        }

        public static int NormalizeMode(float value)
        {
            if (float.IsNaN(value) || float.IsInfinity(value)) return 0;
            var mode = Mathf.RoundToInt(value);
            switch (mode)
            {
                case 0: // THREE.NoToneMapping
                case 1: // THREE.LinearToneMapping
                case 2: // THREE.ReinhardToneMapping
                case 3: // THREE.CineonToneMapping
                case 4: // THREE.ACESFilmicToneMapping
                case 5: // THREE.CustomToneMapping (default custom function is pass-through)
                case 6: // THREE.AgXToneMapping
                case 7: // THREE.NeutralToneMapping
                    return mode;
                default:
                    return 0;
            }
        }

        public static float NormalizeExposure(float value)
        {
            if (float.IsNaN(value) || float.IsInfinity(value)) return 1f;
            // Three forwards finite exposure values unchanged. Existing N.E.K.O
            // configuration intentionally permits the full -10..10 range.
            return value;
        }

        public static bool UsesToneMapping(int mode)
        {
            return mode == 1 || mode == 2 || mode == 3 || mode == 4 || mode == 6 || mode == 7;
        }

        /// <summary>
        /// CPU reference for EditMode/GPU conformance tests. Runtime rendering
        /// uses the shader below; keeping the r180 equations here gives tests a
        /// platform-independent oracle without reading back a WebGL framebuffer.
        /// </summary>
        public static Color EvaluateReference(Color linearColor, int mode, float exposure)
        {
            var normalizedMode = NormalizeMode(mode);
            var normalizedExposure = NormalizeExposure(exposure);
            var color = new Vector3(linearColor.r, linearColor.g, linearColor.b);
            switch (normalizedMode)
            {
                case 1:
                    color = Saturate(color * normalizedExposure);
                    break;
                case 2:
                    color *= normalizedExposure;
                    color = Saturate(new Vector3(
                        color.x / (1f + color.x),
                        color.y / (1f + color.y),
                        color.z / (1f + color.z)));
                    break;
                case 3:
                    color = Cineon(color, normalizedExposure);
                    break;
                case 4:
                    color = AcesFilmic(color, normalizedExposure);
                    break;
                case 6:
                    color = AgX(color, normalizedExposure);
                    break;
                case 7:
                    color = Neutral(color, normalizedExposure);
                    break;
                // NoToneMapping and the default CustomToneMapping function are
                // pass-through and do not apply toneMappingExposure in r180.
                case 0:
                case 5:
                    break;
            }
            return new Color(color.x, color.y, color.z, linearColor.a);
        }

        public static Color EvaluatePremultipliedReference(Color source, int mode, float exposure)
        {
            var normalizedMode = NormalizeMode(mode);
            if (!UsesToneMapping(normalizedMode)) return source;
            if (source.a <= 0.000001f) return new Color(0f, 0f, 0f, source.a);
            var straight = new Color(
                source.r / source.a,
                source.g / source.a,
                source.b / source.a,
                source.a);
            var mapped = EvaluateReference(straight, normalizedMode, exposure);
            return new Color(mapped.r * source.a, mapped.g * source.a, mapped.b * source.a, source.a);
        }

        private void Awake()
        {
            EnsureCamera();
            _camera.allowHDR = UsesToneMapping(_mode);
        }

        private void OnDestroy()
        {
            if (_material == null) return;
            if (Application.isPlaying) Destroy(_material);
            else DestroyImmediate(_material);
            _material = null;
        }

        private void OnRenderImage(RenderTexture source, RenderTexture destination)
        {
            if (!UsesToneMapping(_mode))
            {
                Graphics.Blit(source, destination);
                return;
            }

            var material = GetMaterial();
            if (material == null)
            {
                Graphics.Blit(source, destination);
                return;
            }

            material.SetFloat(ModeProperty, _mode);
            material.SetFloat(ExposureProperty, _exposure);
            var previousSrgbWrite = GL.sRGBWrite;
            try
            {
                GL.sRGBWrite = QualitySettings.activeColorSpace == ColorSpace.Linear;
                Graphics.Blit(source, destination, material, 0);
            }
            finally
            {
                GL.sRGBWrite = previousSrgbWrite;
            }
        }

        private void EnsureCamera()
        {
            if (_camera == null) _camera = GetComponent<Camera>();
        }

        private Material GetMaterial()
        {
            if (_material != null) return _material;
            var shader = Shader.Find(ShaderName);
            if (shader == null || !shader.isSupported)
            {
                if (!_shaderErrorReported)
                {
                    _shaderErrorReported = true;
                    Debug.LogError("[N.E.K.O Unity] Required tone-mapping shader is unavailable: " + ShaderName);
                }
                return null;
            }
            _material = new Material(shader) { hideFlags = HideFlags.HideAndDontSave };
            return _material;
        }

        private static Vector3 Cineon(Vector3 color, float exposure)
        {
            color = Max(color * exposure - Vector3.one * 0.004f, 0f);
            return Pow(new Vector3(
                color.x * (6.2f * color.x + 0.5f) / (color.x * (6.2f * color.x + 1.7f) + 0.06f),
                color.y * (6.2f * color.y + 0.5f) / (color.y * (6.2f * color.y + 1.7f) + 0.06f),
                color.z * (6.2f * color.z + 0.5f) / (color.z * (6.2f * color.z + 1.7f) + 0.06f)),
                2.2f);
        }

        private static Vector3 AcesFilmic(Vector3 color, float exposure)
        {
            color *= exposure / 0.6f;
            color = Transform(
                color,
                new Vector3(0.59719f, 0.35458f, 0.04823f),
                new Vector3(0.07600f, 0.90834f, 0.01566f),
                new Vector3(0.02840f, 0.13383f, 0.83777f));
            color = RrtAndOdtFit(color);
            color = Transform(
                color,
                new Vector3(1.60475f, -0.53108f, -0.07367f),
                new Vector3(-0.10208f, 1.10813f, -0.00605f),
                new Vector3(-0.00327f, -0.07276f, 1.07602f));
            return Saturate(color);
        }

        private static Vector3 RrtAndOdtFit(Vector3 value)
        {
            return new Vector3(
                RrtAndOdtFit(value.x),
                RrtAndOdtFit(value.y),
                RrtAndOdtFit(value.z));
        }

        private static float RrtAndOdtFit(float value)
        {
            var a = value * (value + 0.0245786f) - 0.000090537f;
            var b = value * (0.983729f * value + 0.4329510f) + 0.238081f;
            return a / b;
        }

        private static Vector3 AgX(Vector3 color, float exposure)
        {
            color *= exposure;
            color = Transform(
                color,
                new Vector3(0.6274f, 0.3293f, 0.0433f),
                new Vector3(0.0691f, 0.9195f, 0.0113f),
                new Vector3(0.0164f, 0.0880f, 0.8956f));
            color = Transform(
                color,
                new Vector3(0.8566271533f, 0.0951212405f, 0.0482516061f),
                new Vector3(0.1373189729f, 0.7612419906f, 0.1014390365f),
                new Vector3(0.1118982130f, 0.0767994186f, 0.8113023684f));
            color = Max(color, 0.0000000001f);
            color = new Vector3(Log2(color.x), Log2(color.y), Log2(color.z));
            const float minimumEv = -12.47393f;
            const float maximumEv = 4.026069f;
            color = Saturate((color - Vector3.one * minimumEv) / (maximumEv - minimumEv));
            color = AgXContrast(color);
            color = Transform(
                color,
                new Vector3(1.1271005818f, -0.1106066431f, -0.0164939387f),
                new Vector3(-0.1413297635f, 1.1578237022f, -0.0164939387f),
                new Vector3(-0.1413297635f, -0.1106066431f, 1.2519364066f));
            color = Pow(Max(color, 0f), 2.2f);
            color = Transform(
                color,
                new Vector3(1.6605f, -0.5876f, -0.0728f),
                new Vector3(-0.1246f, 1.1329f, -0.0083f),
                new Vector3(-0.0182f, -0.1006f, 1.1187f));
            return Saturate(color);
        }

        private static Vector3 AgXContrast(Vector3 value)
        {
            var squared = Multiply(value, value);
            var fourth = Multiply(squared, squared);
            return 15.5f * Multiply(fourth, squared)
                   - 40.14f * Multiply(fourth, value)
                   + 31.96f * fourth
                   - 6.868f * Multiply(squared, value)
                   + 0.4298f * squared
                   + 0.1191f * value
                   - Vector3.one * 0.00232f;
        }

        private static Vector3 Neutral(Vector3 color, float exposure)
        {
            const float startCompression = 0.8f - 0.04f;
            const float desaturation = 0.15f;
            color *= exposure;
            var minimum = Mathf.Min(color.x, Mathf.Min(color.y, color.z));
            var offset = minimum < 0.08f ? minimum - 6.25f * minimum * minimum : 0.04f;
            color -= Vector3.one * offset;
            var peak = Mathf.Max(color.x, Mathf.Max(color.y, color.z));
            if (peak < startCompression) return color;
            var distance = 1f - startCompression;
            var newPeak = 1f - distance * distance / (peak + distance - startCompression);
            color *= newPeak / peak;
            var weight = 1f - 1f / (desaturation * (peak - newPeak) + 1f);
            return Vector3.LerpUnclamped(color, Vector3.one * newPeak, weight);
        }

        private static Vector3 Transform(Vector3 value, Vector3 row0, Vector3 row1, Vector3 row2)
        {
            return new Vector3(
                Vector3.Dot(row0, value),
                Vector3.Dot(row1, value),
                Vector3.Dot(row2, value));
        }

        private static Vector3 Multiply(Vector3 left, Vector3 right)
        {
            return new Vector3(left.x * right.x, left.y * right.y, left.z * right.z);
        }

        private static Vector3 Max(Vector3 value, float minimum)
        {
            return new Vector3(
                Mathf.Max(value.x, minimum),
                Mathf.Max(value.y, minimum),
                Mathf.Max(value.z, minimum));
        }

        private static Vector3 Pow(Vector3 value, float exponent)
        {
            return new Vector3(
                Mathf.Pow(value.x, exponent),
                Mathf.Pow(value.y, exponent),
                Mathf.Pow(value.z, exponent));
        }

        private static Vector3 Saturate(Vector3 value)
        {
            return new Vector3(
                Mathf.Clamp01(value.x),
                Mathf.Clamp01(value.y),
                Mathf.Clamp01(value.z));
        }

        private static float Log2(float value)
        {
            return Mathf.Log(value) / Mathf.Log(2f);
        }
    }
}
