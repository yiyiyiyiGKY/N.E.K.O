using System;
using System.IO;
using System.Reflection;
using Neko.Avatar.Editor;
using NUnit.Framework;

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
