using System;
using System.Collections;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Neko.Avatar.Editor;
using NUnit.Framework;
using UniGLTF;
using UniGLTF.Utils;
using UniVRM10;
using UnityEngine;
using UnityEngine.TestTools;

namespace Neko.Avatar.Tests
{
    public sealed class NekoAvatarWebGLBuildTests
    {
        private static MethodInfo GetBuildMethod(string name)
        {
            var method = typeof(NekoAvatarWebGLBuild).GetMethod(
                name,
                BindingFlags.Static | BindingFlags.NonPublic);
            Assert.That(method, Is.Not.Null, name + " helper is missing");
            return method;
        }

        [Test]
        public void RuntimeShaderListContainsOnlyImportableShaders()
        {
            var field = typeof(NekoAvatarWebGLBuild).GetField(
                "RequiredRuntimeShaders",
                BindingFlags.Static | BindingFlags.NonPublic);
            Assert.That(field, Is.Not.Null);

            var shaderNames = (string[])field.GetValue(null);
            Assert.That(shaderNames, Does.Contain("UniGLTF/UniUnlit"));
            Assert.That(shaderNames, Does.Not.Contain("Standard"));
            Assert.That(
                shaderNames.Where(name => Shader.Find(name) == null),
                Is.Empty,
                "Every required runtime shader must be importable before the WebGL build starts");
        }

        [Test]
        public void TransparentCanvasPluginGuardsTheFinalAlphaOnlyClear()
        {
            var pluginPath = Path.Combine(
                Application.dataPath,
                "Plugins",
                "WebGL",
                "NekoTransparentCanvas.jslib");
            Assert.That(File.Exists(pluginPath), Is.True, pluginPath);

            var source = File.ReadAllText(pluginPath);
            StringAssert.Contains("GLctx.getParameter(GLctx.COLOR_WRITEMASK)", source);
            StringAssert.Contains("mask === 0x00004000", source);
            StringAssert.Contains("GLctx.clear(mask)", source);
        }

        [Test]
        public void TransparentCanvasPluginDisablesColorForLinkedDepthOnlyDraws()
        {
            var pluginPath = Path.Combine(
                Application.dataPath,
                "Plugins",
                "WebGL",
                "NekoTransparentCanvas.jslib");
            Assert.That(File.Exists(pluginPath), Is.True, pluginPath);

            var source = File.ReadAllText(pluginPath);
            StringAssert.Contains("glDrawElements: function", source);
            StringAssert.Contains("getFragDataLocation(program, 'SV_Target' + output)", source);
            StringAssert.Contains("GLctx.drawBuffers(disabledDrawBuffers)", source);
            StringAssert.Contains("GLctx.drawBuffers(previousDrawBuffers)", source);
        }

        [Test]
        public void VrmAnimationDefaultMaterialReusesRetainedUniUnlitShader()
        {
            var method = typeof(NekoAvatarController).GetMethod(
                "CreateAnimationMaterialDescriptorGenerator",
                BindingFlags.Static | BindingFlags.NonPublic);
            Assert.That(method, Is.Not.Null);

            var generator = method.Invoke(null, null);
            Assert.That(generator, Is.Not.Null);
            var getDefault = generator.GetType().GetMethod("GetGltfDefault");
            Assert.That(getDefault, Is.Not.Null);
            var descriptor = getDefault.Invoke(generator, new object[] { null });
            var shaderField = descriptor.GetType().GetField("Shader");
            Assert.That(shaderField, Is.Not.Null);
            var shader = (Shader)shaderField.GetValue(descriptor);

            Assert.That(shader, Is.Not.Null);
            Assert.That(shader.name, Is.EqualTo("UniGLTF/UniUnlit"));
        }

        [Test]
        public async Task BundledWaitAnimationImportsWhenExpressionsPrecedeSceneRoot()
        {
            var repositoryRoot = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", ".."));
            var path = Path.Combine(repositoryRoot, "static", "vrm", "animation", "wait03.vrma.gz");
            byte[] bytes;
            using (var input = File.OpenRead(path))
            using (var gzip = new GZipStream(input, CompressionMode.Decompress))
            using (var output = new MemoryStream())
            {
                gzip.CopyTo(output);
                bytes = output.ToArray();
            }

            RuntimeGltfInstance loaded = null;
            using (var data = GlbLowLevelParser.Parse(string.Empty, bytes))
            {
                var normalizer = typeof(NekoAvatarController).Assembly
                    .GetType("Neko.Avatar.VrmAnimationImportNormalizer")
                    .GetMethod("Normalize", BindingFlags.Static | BindingFlags.Public);
                Assert.That((bool)normalizer.Invoke(null, new object[] { data }), Is.True);
                Assert.That(
                    data.GLTF.nodes.Select(node => node.name).Distinct().Count(),
                    Is.EqualTo(data.GLTF.nodes.Count),
                    "VRMA node names must be unique before UniVRM builds its humanoid Avatar");

                var materialFactory = typeof(NekoAvatarController).GetMethod(
                    "CreateAnimationMaterialDescriptorGenerator",
                    BindingFlags.Static | BindingFlags.NonPublic);
                var generator = (IMaterialDescriptorGenerator)materialFactory.Invoke(null, null);
                using (var importer = new VrmAnimationImporter(
                    new VrmAnimationData(data),
                    materialGenerator: generator))
                {
                    loaded = await importer.LoadAsync(new ImmediateCaller());
                }
            }

            try
            {
                Assert.That(loaded, Is.Not.Null);
                Assert.That(loaded.GetComponent<Vrm10AnimationInstance>(), Is.Not.Null);
                Assert.That(loaded.GetComponent<Animation>(), Is.Not.Null);
            }
            finally
            {
                if (loaded != null) UnityEngine.Object.DestroyImmediate(loaded.gameObject);
            }
        }

        [Test]
        public async Task BundledVrmZeroModelProvidesCapturedHumanoidRestPose()
        {
            var repositoryRoot = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", ".."));
            var path = Path.Combine(repositoryRoot, "static", "vrm", "sister1.0.vrm");
            var controllerObject = new GameObject("rest-pose-controller");
            controllerObject.SetActive(false);
            Vrm10Instance avatar = null;
            FieldInfo avatarField = null;
            try
            {
                avatar = await Vrm10.LoadBytesAsync(
                    File.ReadAllBytes(path),
                    canLoadVrm0X: true,
                    showMeshes: false,
                    awaitCaller: new ImmediateCaller());
                Assert.That(avatar, Is.Not.Null);

                var controller = controllerObject.AddComponent<NekoAvatarController>();
                avatarField = typeof(NekoAvatarController).GetField(
                    "_avatar",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                avatarField.SetValue(controller, avatar);
                var animator = avatar.GetComponent<Animator>();
                Assert.That(animator, Is.Not.Null);
                animator.avatar = null;
                Assert.That(animator.isHuman, Is.False,
                    "The regression path must not rely on Animator readiness during model configuration");
                var capture = typeof(NekoAvatarController).GetMethod(
                    "CaptureRestPose",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                var tryGet = typeof(NekoAvatarController).GetMethod(
                    "TryGetRestTransformState",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                Assert.That(capture, Is.Not.Null);
                Assert.That(tryGet, Is.Not.Null);
                capture.Invoke(controller, new object[] { avatar });

                var hips = avatar.Humanoid.GetBoneTransform(HumanBodyBones.Hips);
                Assert.That(hips, Is.Not.Null);
                var capturedField = typeof(NekoAvatarController).GetField(
                    "_capturedRestPoseByAvatar",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                var capturedByAvatar = (IDictionary)capturedField.GetValue(controller);
                Assert.That(capturedByAvatar.Contains(avatar), Is.True);
                var capturedBones = (IDictionary)capturedByAvatar[avatar];
                Assert.That(capturedBones.Contains(hips), Is.True,
                    "Humanoid rest pose must be captured before the Animator runtime Avatar is ready");
                var arguments = new object[] { hips, null };
                Assert.That((bool)tryGet.Invoke(controller, arguments), Is.True);
                Assert.That(arguments[1], Is.Not.Null);

                LogAssert.Expect(
                    LogType.Log,
                    new Regex("\\[NekoAvatarEvent\\].*\\\"name\\\":\\\"vmc.snapshot\\\".*\\\"restPose\\\":\\[\\{"));
                controller.HandleCommand(
                    "{\"v\":1,\"id\":\"rest-pose-test\",\"generation\":0," +
                    "\"command\":\"vmc.snapshot\",\"body\":{}}");
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
                if (avatar != null) UnityEngine.Object.DestroyImmediate(avatar.gameObject);
            }
        }

        [Test]
        public void StagedPublicationReplacesTheCompletePreviousBuild()
        {
            var root = CreateTemporaryRoot();
            try
            {
                var output = Path.Combine(root, "avatar");
                var staging = Path.Combine(root, ".avatar.staging-test");
                Directory.CreateDirectory(output);
                Directory.CreateDirectory(staging);
                File.WriteAllText(Path.Combine(output, "old.txt"), "old");
                File.WriteAllText(Path.Combine(staging, "new.txt"), "new");

                GetBuildMethod("PublishStagedBuild").Invoke(null, new object[] { staging, output });

                Assert.That(File.Exists(Path.Combine(output, "new.txt")), Is.True);
                Assert.That(File.Exists(Path.Combine(output, "old.txt")), Is.False);
                Assert.That(Directory.Exists(staging), Is.False);
                Assert.That(Directory.GetDirectories(root, ".avatar.backup-*"), Is.Empty);
            }
            finally
            {
                DeleteTemporaryRoot(root);
            }
        }

        [Test]
        public void FailedPublicationRestoresThePreviousBuild()
        {
            var root = CreateTemporaryRoot();
            try
            {
                var output = Path.Combine(root, "avatar");
                var missingStaging = Path.Combine(root, ".avatar.missing-staging");
                Directory.CreateDirectory(output);
                File.WriteAllText(Path.Combine(output, "old.txt"), "old");

                var error = Assert.Throws<TargetInvocationException>(() =>
                    GetBuildMethod("PublishStagedBuild").Invoke(
                        null,
                        new object[] { missingStaging, output }));

                Assert.That(error.InnerException, Is.InstanceOf<IOException>());
                Assert.That(File.ReadAllText(Path.Combine(output, "old.txt")), Is.EqualTo("old"));
                Assert.That(Directory.GetDirectories(root, ".avatar.backup-*"), Is.Empty);
            }
            finally
            {
                DeleteTemporaryRoot(root);
            }
        }

        [Test]
        public void OutputValidationRejectsAnExistingFile()
        {
            var root = CreateTemporaryRoot();
            try
            {
                var file = Path.Combine(root, "avatar");
                File.WriteAllText(file, "not a directory");

                var error = Assert.Throws<TargetInvocationException>(() =>
                    GetBuildMethod("ValidateOutputPath").Invoke(null, new object[] { file }));

                Assert.That(error.InnerException, Is.TypeOf<InvalidOperationException>());
            }
            finally
            {
                DeleteTemporaryRoot(root);
            }
        }

        [Test]
        public void OutputValidationRejectsTheFilesystemRoot()
        {
            var root = Path.GetPathRoot(Path.GetFullPath(Path.GetTempPath()));

            var error = Assert.Throws<TargetInvocationException>(() =>
                GetBuildMethod("ValidateOutputPath").Invoke(null, new object[] { root }));

            Assert.That(error.InnerException, Is.TypeOf<InvalidOperationException>());
        }

        [Test]
        public void OutputValidationRejectsAnUnrecognizedNonEmptyDirectory()
        {
            var root = CreateTemporaryRoot();
            try
            {
                var directory = Path.Combine(root, "avatar");
                Directory.CreateDirectory(directory);
                File.WriteAllText(Path.Combine(directory, "user-file.txt"), "must not be replaced");

                var error = Assert.Throws<TargetInvocationException>(() =>
                    GetBuildMethod("ValidateOutputPath").Invoke(null, new object[] { directory }));

                Assert.That(error.InnerException, Is.TypeOf<InvalidOperationException>());
                Assert.That(File.Exists(Path.Combine(directory, "user-file.txt")), Is.True);
            }
            finally
            {
                DeleteTemporaryRoot(root);
            }
        }

        private static string CreateTemporaryRoot()
        {
            var path = Path.Combine(
                Path.GetTempPath(),
                "neko-avatar-build-test-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(path);
            return path;
        }

        private static void DeleteTemporaryRoot(string path)
        {
            if (!string.IsNullOrEmpty(path) && Directory.Exists(path))
            {
                Directory.Delete(path, true);
            }
        }
    }
}
