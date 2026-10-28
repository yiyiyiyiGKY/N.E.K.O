using System.Reflection;
using NUnit.Framework;
using UnityEngine;

namespace Neko.Avatar.Tests
{
    public sealed class NekoAvatarToneMappingTests
    {
        [TestCase(0f, 0)]
        [TestCase(1f, 1)]
        [TestCase(2f, 2)]
        [TestCase(3f, 3)]
        [TestCase(4f, 4)]
        [TestCase(5f, 5)]
        [TestCase(6f, 6)]
        [TestCase(7f, 7)]
        [TestCase(-1f, 0)]
        [TestCase(8f, 0)]
        public void ModeNumbersMatchThreeR180(float input, int expected)
        {
            Assert.That(NekoAvatarToneMappingEffect.NormalizeMode(input), Is.EqualTo(expected));
        }

        [Test]
        public void NonFiniteSettingsHaveStableFallbacks()
        {
            Assert.That(NekoAvatarToneMappingEffect.NormalizeMode(float.NaN), Is.Zero);
            Assert.That(NekoAvatarToneMappingEffect.NormalizeMode(float.PositiveInfinity), Is.Zero);
            Assert.That(NekoAvatarToneMappingEffect.NormalizeExposure(float.NaN), Is.EqualTo(1f));
            Assert.That(NekoAvatarToneMappingEffect.NormalizeExposure(float.NegativeInfinity), Is.EqualTo(1f));
            Assert.That(NekoAvatarToneMappingEffect.NormalizeExposure(-3.5f), Is.EqualTo(-3.5f));
        }

        [TestCase(1, 1.000000000f, 0.550000000f, 0.110000000f)]
        [TestCase(2, 0.568965517f, 0.354838710f, 0.099099099f)]
        [TestCase(3, 0.744031351f, 0.527721331f, 0.130195938f)]
        [TestCase(4, 0.873220065f, 0.607892702f, 0.218335144f)]
        [TestCase(6, 0.690405002f, 0.447875353f, 0.237797442f)]
        [TestCase(7, 0.924210526f, 0.396408113f, 0.094806734f)]
        public void CpuReferenceMatchesThreeR180Equations(
            int mode,
            float expectedRed,
            float expectedGreen,
            float expectedBlue)
        {
            var actual = NekoAvatarToneMappingEffect.EvaluateReference(
                new Color(1.2f, 0.5f, 0.1f, 0.37f),
                mode,
                1.1f);
            Assert.That(actual.r, Is.EqualTo(expectedRed).Within(0.00001f));
            Assert.That(actual.g, Is.EqualTo(expectedGreen).Within(0.00001f));
            Assert.That(actual.b, Is.EqualTo(expectedBlue).Within(0.00001f));
            Assert.That(actual.a, Is.EqualTo(0.37f).Within(0.000001f));
        }

        [TestCase(0)]
        [TestCase(5)]
        public void PassThroughModesIgnoreExposure(int mode)
        {
            var source = new Color(1.2f, 0.5f, 0.1f, 0.37f);
            var actual = NekoAvatarToneMappingEffect.EvaluateReference(source, mode, -9f);
            Assert.That(actual.r, Is.EqualTo(source.r));
            Assert.That(actual.g, Is.EqualTo(source.g));
            Assert.That(actual.b, Is.EqualTo(source.b));
            Assert.That(actual.a, Is.EqualTo(source.a));
        }

        [Test]
        public void TransparentPostProcessPreservesAlphaAndPremultiplication()
        {
            var source = new Color(0.4f, 0.2f, 0.1f, 0.5f);
            var straight = NekoAvatarToneMappingEffect.EvaluateReference(
                new Color(0.8f, 0.4f, 0.2f, 0.5f),
                7,
                1.1f);
            var actual = NekoAvatarToneMappingEffect.EvaluatePremultipliedReference(source, 7, 1.1f);
            Assert.That(actual.r, Is.EqualTo(straight.r * 0.5f).Within(0.00001f));
            Assert.That(actual.g, Is.EqualTo(straight.g * 0.5f).Within(0.00001f));
            Assert.That(actual.b, Is.EqualTo(straight.b * 0.5f).Within(0.00001f));
            Assert.That(actual.a, Is.EqualTo(0.5f));

            var transparent = NekoAvatarToneMappingEffect.EvaluatePremultipliedReference(
                new Color(7f, 5f, 3f, 0f),
                7,
                1.1f);
            Assert.That(transparent, Is.EqualTo(new Color(0f, 0f, 0f, 0f)));
        }

        [Test]
        public void ConfigureOnlyEnablesHdrForAnActualToneMapper()
        {
            var gameObject = new GameObject("tone-mapping-test");
            try
            {
                var camera = gameObject.AddComponent<Camera>();
                var effect = gameObject.AddComponent<NekoAvatarToneMappingEffect>();
                effect.Configure(7f, 1.1f);
                Assert.That(effect.enabled, Is.True);
                Assert.That(camera.allowHDR, Is.True);

                effect.Configure(0f, -2f);
                Assert.That(effect.enabled, Is.False);
                Assert.That(camera.allowHDR, Is.False);
                Assert.That(effect.Exposure, Is.EqualTo(-2f));
            }
            finally
            {
                Object.DestroyImmediate(gameObject);
            }
        }

        [Test]
        public void ControllerRoutesExposureToToneMappingWithoutScalingLights()
        {
            var originalAmbient = RenderSettings.ambientLight;
            var originalAmbientMode = RenderSettings.ambientMode;
            var controllerObject = new GameObject("tone-mapping-controller-test");
            controllerObject.SetActive(false);
            var cameraObject = new GameObject("tone-mapping-camera-test");
            cameraObject.tag = "MainCamera";
            cameraObject.AddComponent<Camera>();
            try
            {
                var controller = controllerObject.AddComponent<NekoAvatarController>();
                InvokePrivate(controller, "ConfigureScene");

                var effect = cameraObject.GetComponent<NekoAvatarToneMappingEffect>();
                Assert.That(effect, Is.Not.Null);
                Assert.That(effect.Mode, Is.EqualTo(7));
                Assert.That(effect.Exposure, Is.EqualTo(1.1f));

                var lightingType = typeof(NekoAvatarController).GetNestedType(
                    "LightingBody",
                    BindingFlags.NonPublic);
                Assert.That(lightingType, Is.Not.Null);
                var lighting = System.Activator.CreateInstance(lightingType);
                lightingType.GetField("ambient").SetValue(lighting, 0.25f);
                lightingType.GetField("main").SetValue(lighting, 0.75f);
                lightingType.GetField("exposure").SetValue(lighting, 2f);
                lightingType.GetField("toneMapping").SetValue(lighting, 1f);
                InvokePrivate(controller, "ApplyLighting", lighting);

                var mainLight = (Light)typeof(NekoAvatarController)
                    .GetField("_mainLight", BindingFlags.Instance | BindingFlags.NonPublic)
                    .GetValue(controller);
                Assert.That(RenderSettings.ambientLight.r, Is.EqualTo(0.25f).Within(0.00001f));
                Assert.That(mainLight.intensity, Is.EqualTo(0.75f).Within(0.00001f));
                Assert.That(effect.Mode, Is.EqualTo(1));
                Assert.That(effect.Exposure, Is.EqualTo(2f));
                Assert.That(effect.enabled, Is.True);
                Assert.That(cameraObject.GetComponent<Camera>().allowHDR, Is.True);
            }
            finally
            {
                RenderSettings.ambientLight = originalAmbient;
                RenderSettings.ambientMode = originalAmbientMode;
                Object.DestroyImmediate(controllerObject);
                Object.DestroyImmediate(cameraObject);
            }
        }

        private static object InvokePrivate(object target, string methodName, params object[] arguments)
        {
            var method = target.GetType().GetMethod(
                methodName,
                BindingFlags.Instance | BindingFlags.NonPublic);
            Assert.That(method, Is.Not.Null, methodName);
            return method.Invoke(target, arguments);
        }
    }
}
