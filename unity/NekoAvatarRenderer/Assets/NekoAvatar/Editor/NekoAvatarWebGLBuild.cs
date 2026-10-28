using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;

namespace Neko.Avatar.Editor
{
    public static class NekoAvatarWebGLBuild
    {
        private const string GeneratedDirectory = "Assets/NekoAvatar/Generated";
        private const string GeneratedSceneName = "NekoAvatarWebGL.unity";
        private static readonly string[] RequiredRuntimeShaders =
        {
            "VRM10/MToon10",
            "UniGLTF/UniUnlit",
            NekoAvatarToneMappingEffect.ShaderName
        };

        private sealed class WebGlHdrTierScope : IDisposable
        {
            private static readonly GraphicsTier[] Tiers =
            {
                GraphicsTier.Tier1,
                GraphicsTier.Tier2,
                GraphicsTier.Tier3
            };

            private readonly UnityEditor.Rendering.TierSettings[] _original =
                new UnityEditor.Rendering.TierSettings[Tiers.Length];
            private int _configuredCount;
            private bool _disposed;

            public WebGlHdrTierScope()
            {
                try
                {
                    for (var index = 0; index < Tiers.Length; ++index)
                    {
                        var settings = UnityEditor.Rendering.EditorGraphicsSettings.GetTierSettings(
                            BuildTargetGroup.WebGL,
                            Tiers[index]);
                        _original[index] = settings;
                        _configuredCount = index + 1;
                        settings.hdr = true;
                        // FP16 maps to RenderTextureFormat.ARGBHalf. Unlike
                        // R11G11B10, it retains the transparent avatar alpha.
                        settings.hdrMode = CameraHDRMode.FP16;
                        UnityEditor.Rendering.EditorGraphicsSettings.SetTierSettings(
                            BuildTargetGroup.WebGL,
                            Tiers[index],
                            settings);
                    }
                }
                catch
                {
                    Restore();
                    throw;
                }
            }

            public void Dispose()
            {
                Restore();
            }

            private void Restore()
            {
                if (_disposed) return;
                _disposed = true;
                for (var index = 0; index < _configuredCount; ++index)
                {
                    UnityEditor.Rendering.EditorGraphicsSettings.SetTierSettings(
                        BuildTargetGroup.WebGL,
                        Tiers[index],
                        _original[index]);
                }
            }
        }

        private sealed class AlwaysIncludedShaderScope : IDisposable
        {
            private readonly Shader[] _original;
            private bool _disposed;

            public AlwaysIncludedShaderScope()
            {
                var serialized = new SerializedObject(GraphicsSettings.GetGraphicsSettings());
                var shaders = serialized.FindProperty("m_AlwaysIncludedShaders");
                if (shaders == null)
                {
                    throw new InvalidOperationException("Unity GraphicsSettings has no always-included shader list");
                }

                _original = new Shader[shaders.arraySize];
                var included = new HashSet<Shader>();
                for (var index = 0; index < shaders.arraySize; ++index)
                {
                    var shader = shaders.GetArrayElementAtIndex(index).objectReferenceValue as Shader;
                    _original[index] = shader;
                    if (shader != null) included.Add(shader);
                }

                try
                {
                    foreach (var shaderName in RequiredRuntimeShaders)
                    {
                        var shader = Shader.Find(shaderName);
                        if (shader == null)
                        {
                            throw new InvalidOperationException("Required runtime shader was not imported: " + shaderName);
                        }
                        if (included.Contains(shader)) continue;
                        shaders.InsertArrayElementAtIndex(shaders.arraySize);
                        shaders.GetArrayElementAtIndex(shaders.arraySize - 1).objectReferenceValue = shader;
                        included.Add(shader);
                    }
                    serialized.ApplyModifiedProperties();
                }
                catch
                {
                    Restore();
                    throw;
                }
            }

            public void Dispose()
            {
                Restore();
            }

            private void Restore()
            {
                if (_disposed) return;
                _disposed = true;
                var serialized = new SerializedObject(GraphicsSettings.GetGraphicsSettings());
                var shaders = serialized.FindProperty("m_AlwaysIncludedShaders");
                if (shaders == null) return;
                shaders.arraySize = _original.Length;
                for (var index = 0; index < _original.Length; ++index)
                {
                    shaders.GetArrayElementAtIndex(index).objectReferenceValue = _original[index];
                }
                serialized.ApplyModifiedProperties();
            }
        }

        private sealed class PlayerSettingsScope : IDisposable
        {
            private readonly string _companyName = PlayerSettings.companyName;
            private readonly string _productName = PlayerSettings.productName;
            private readonly string _bundleVersion = PlayerSettings.bundleVersion;
            private readonly bool _runInBackground = PlayerSettings.runInBackground;
            private readonly ColorSpace _colorSpace = PlayerSettings.colorSpace;
            private readonly bool _preserveFramebufferAlpha = PlayerSettings.preserveFramebufferAlpha;
            private readonly InsecureHttpOption _insecureHttpOption = PlayerSettings.insecureHttpOption;
            private readonly ScriptingImplementation _scriptingBackend =
                PlayerSettings.GetScriptingBackend(BuildTargetGroup.WebGL);
            private readonly WebGLCompressionFormat _compressionFormat = PlayerSettings.WebGL.compressionFormat;
            private readonly bool _decompressionFallback = PlayerSettings.WebGL.decompressionFallback;
            private readonly bool _dataCaching = PlayerSettings.WebGL.dataCaching;
            private readonly int _initialMemorySize = PlayerSettings.WebGL.initialMemorySize;
            private readonly int _maximumMemorySize = PlayerSettings.WebGL.maximumMemorySize;
            private readonly WebGLMemoryGrowthMode _memoryGrowthMode = PlayerSettings.WebGL.memoryGrowthMode;
            private readonly float _geometricMemoryGrowthStep = PlayerSettings.WebGL.geometricMemoryGrowthStep;
            private readonly int _memoryGeometricGrowthCap = PlayerSettings.WebGL.memoryGeometricGrowthCap;
            private readonly bool _nameFilesAsHashes = PlayerSettings.WebGL.nameFilesAsHashes;
            private bool _disposed;

            public void Dispose()
            {
                if (_disposed) return;
                _disposed = true;
                PlayerSettings.companyName = _companyName;
                PlayerSettings.productName = _productName;
                PlayerSettings.bundleVersion = _bundleVersion;
                PlayerSettings.runInBackground = _runInBackground;
                PlayerSettings.colorSpace = _colorSpace;
                PlayerSettings.preserveFramebufferAlpha = _preserveFramebufferAlpha;
                PlayerSettings.insecureHttpOption = _insecureHttpOption;
                PlayerSettings.SetScriptingBackend(BuildTargetGroup.WebGL, _scriptingBackend);
                PlayerSettings.WebGL.compressionFormat = _compressionFormat;
                PlayerSettings.WebGL.decompressionFallback = _decompressionFallback;
                PlayerSettings.WebGL.dataCaching = _dataCaching;
                PlayerSettings.WebGL.initialMemorySize = _initialMemorySize;
                PlayerSettings.WebGL.maximumMemorySize = _maximumMemorySize;
                PlayerSettings.WebGL.memoryGrowthMode = _memoryGrowthMode;
                PlayerSettings.WebGL.geometricMemoryGrowthStep = _geometricMemoryGrowthStep;
                PlayerSettings.WebGL.memoryGeometricGrowthCap = _memoryGeometricGrowthCap;
                PlayerSettings.WebGL.nameFilesAsHashes = _nameFilesAsHashes;
            }
        }

        [Serializable]
        private sealed class BuildManifest
        {
            public int version = 1;
            public string loaderUrl;
            public string dataUrl;
            public string frameworkUrl;
            public string codeUrl;
            public string streamingAssetsUrl;
            public string companyName = "Project N.E.K.O.";
            public string productName = "NekoAvatarRenderer";
            public string productVersion = "1.0.0";
        }

        [MenuItem("N.E.K.O/Build Unity Avatar WebGL")]
        public static void Build()
        {
            var outputPath = ResolveOutputPath();
            ValidateOutputPath(outputPath);
            var stagingPath = CreateUniqueSiblingPath(outputPath, "staging");
            var originalActiveScene = SceneManager.GetActiveScene();
            var generatedScene = default(Scene);
            string generatedScenePath = null;
            var createdGeneratedDirectory = false;

            try
            {
                if (!AssetDatabase.IsValidFolder(GeneratedDirectory))
                {
                    var folderGuid = AssetDatabase.CreateFolder("Assets/NekoAvatar", "Generated");
                    if (string.IsNullOrEmpty(folderGuid))
                    {
                        throw new InvalidOperationException("Could not create the generated Unity scene directory");
                    }
                    createdGeneratedDirectory = true;
                }

                generatedScenePath = AssetDatabase.GenerateUniqueAssetPath(
                    GeneratedDirectory + "/" + GeneratedSceneName);
                generatedScene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Additive);
                SceneManager.SetActiveScene(generatedScene);
                var controllerObject = new GameObject(NekoAvatarProtocol.ControllerObjectName);
                controllerObject.AddComponent<NekoAvatarController>();
                if (!EditorSceneManager.SaveScene(generatedScene, generatedScenePath))
                {
                    throw new InvalidOperationException("Could not save the generated Unity avatar scene");
                }

                Directory.CreateDirectory(stagingPath);
                using (new PlayerSettingsScope())
                {
                    ConfigurePlayer();
                    var options = new BuildPlayerOptions
                    {
                        scenes = new[] { generatedScenePath },
                        locationPathName = stagingPath,
                        target = BuildTarget.WebGL,
                        options = BuildOptions.None
                    };

                    BuildReport report;
                    using (new WebGlHdrTierScope())
                    using (new AlwaysIncludedShaderScope())
                    {
                        report = BuildPipeline.BuildPlayer(options);
                    }
                    if (report.summary.result != BuildResult.Succeeded)
                    {
                        throw new InvalidOperationException(
                            "N.E.K.O Unity avatar build failed: " + report.summary.result +
                            ", errors=" + report.summary.totalErrors);
                    }
                }

                WriteBuildManifest(stagingPath);
                PublishStagedBuild(stagingPath, outputPath);
                stagingPath = null;
                Debug.Log("[N.E.K.O Unity] WebGL build complete: " + outputPath);
            }
            finally
            {
                if (originalActiveScene.IsValid() && originalActiveScene.isLoaded)
                {
                    SceneManager.SetActiveScene(originalActiveScene);
                }
                if (generatedScene.IsValid() && generatedScene.isLoaded)
                {
                    EditorSceneManager.CloseScene(generatedScene, true);
                }
                if (!string.IsNullOrEmpty(generatedScenePath))
                {
                    AssetDatabase.DeleteAsset(generatedScenePath);
                }
                if (createdGeneratedDirectory && AssetDatabase.IsValidFolder(GeneratedDirectory))
                {
                    AssetDatabase.DeleteAsset(GeneratedDirectory);
                }
                AssetDatabase.Refresh();
                if (!string.IsNullOrEmpty(stagingPath)) TryDeleteDirectory(stagingPath);
            }
        }

        private static void ValidateOutputPath(string outputPath)
        {
            if (string.IsNullOrWhiteSpace(outputPath))
            {
                throw new InvalidOperationException("Unity WebGL output path is empty");
            }

            var fullPath = Path.GetFullPath(outputPath);
            var normalized = fullPath.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            var root = Path.GetPathRoot(fullPath)
                ?.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            if (string.IsNullOrEmpty(normalized) || string.Equals(normalized, root, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Unity WebGL output cannot be a filesystem root");
            }
            if (File.Exists(normalized))
            {
                throw new InvalidOperationException("Unity WebGL output is an existing file: " + normalized);
            }
            if (Directory.Exists(normalized) &&
                Directory.GetFileSystemEntries(normalized).Length > 0 &&
                !File.Exists(Path.Combine(normalized, "build-manifest.json")))
            {
                throw new InvalidOperationException(
                    "Refusing to replace a non-empty directory that is not a N.E.K.O Unity avatar build: " +
                    normalized);
            }
        }

        private static string CreateUniqueSiblingPath(string outputPath, string purpose)
        {
            var normalized = Path.GetFullPath(outputPath)
                .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            var parent = Path.GetDirectoryName(normalized);
            var name = Path.GetFileName(normalized);
            if (string.IsNullOrEmpty(parent) || string.IsNullOrEmpty(name))
            {
                throw new InvalidOperationException("Unity WebGL output must name a directory");
            }
            Directory.CreateDirectory(parent);
            return Path.Combine(parent, "." + name + "." + purpose + "-" + Guid.NewGuid().ToString("N"));
        }

        private static void PublishStagedBuild(string stagingPath, string outputPath)
        {
            var backupPath = default(string);
            var published = false;
            try
            {
                if (Directory.Exists(outputPath))
                {
                    backupPath = CreateUniqueSiblingPath(outputPath, "backup");
                    Directory.Move(outputPath, backupPath);
                }
                Directory.Move(stagingPath, outputPath);
                published = true;
            }
            catch
            {
                if (!string.IsNullOrEmpty(backupPath) &&
                    Directory.Exists(backupPath) &&
                    !Directory.Exists(outputPath))
                {
                    Directory.Move(backupPath, outputPath);
                    backupPath = null;
                }
                throw;
            }
            finally
            {
                // A failed rollback must leave the backup intact for manual
                // recovery. Only a completed publication may retire it.
                if (published && !string.IsNullOrEmpty(backupPath)) TryDeleteDirectory(backupPath);
            }
        }

        private static void TryDeleteDirectory(string path)
        {
            if (string.IsNullOrEmpty(path) || !Directory.Exists(path)) return;
            try
            {
                Directory.Delete(path, true);
            }
            catch (Exception error)
            {
                Debug.LogWarning("[N.E.K.O Unity] Could not remove temporary build directory " + path + ": " + error.Message);
            }
        }

        private static string ResolveOutputPath()
        {
            var configured = Environment.GetEnvironmentVariable("NEKO_UNITY_WEBGL_OUTPUT");
            if (!string.IsNullOrWhiteSpace(configured)) return Path.GetFullPath(configured);

            var projectRoot = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
            var repositoryRoot = Path.GetFullPath(Path.Combine(projectRoot, "..", ".."));
            return Path.Combine(repositoryRoot, "static", "unity", "avatar");
        }

        private static void ConfigurePlayer()
        {
            PlayerSettings.companyName = "Project N.E.K.O.";
            PlayerSettings.productName = "NekoAvatarRenderer";
            PlayerSettings.bundleVersion = "1.0.0";
            PlayerSettings.runInBackground = true;
            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.preserveFramebufferAlpha = true;
            // N.E.K.O desktop serves the Pet page and avatar assets from its local
            // http://127.0.0.1 FastAPI instance.
            PlayerSettings.insecureHttpOption = InsecureHttpOption.AlwaysAllowed;
            PlayerSettings.SetScriptingBackend(BuildTargetGroup.WebGL, ScriptingImplementation.IL2CPP);
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
            PlayerSettings.WebGL.decompressionFallback = false;
            PlayerSettings.WebGL.dataCaching = true;
            PlayerSettings.WebGL.initialMemorySize = 128;
            PlayerSettings.WebGL.maximumMemorySize = 2048;
            PlayerSettings.WebGL.memoryGrowthMode = WebGLMemoryGrowthMode.Geometric;
            PlayerSettings.WebGL.geometricMemoryGrowthStep = 0.2f;
            PlayerSettings.WebGL.memoryGeometricGrowthCap = 96;
            // The manifest is revalidated on every runtime boot.  Content-hashed
            // payload names prevent a newly published player from reusing stale
            // data/framework/wasm files from the browser or Unity data cache.
            PlayerSettings.WebGL.nameFilesAsHashes = true;
        }

        private static void WriteBuildManifest(string outputPath)
        {
            var buildDirectory = Path.Combine(outputPath, "Build");
            var publicBase = Environment.GetEnvironmentVariable("NEKO_UNITY_WEBGL_PUBLIC_BASE");
            if (string.IsNullOrWhiteSpace(publicBase)) publicBase = "/static/unity/avatar";
            publicBase = publicBase.TrimEnd('/');

            var manifest = new BuildManifest
            {
                loaderUrl = publicBase + "/Build/" + FindBuildFile(buildDirectory, "*.loader.js"),
                dataUrl = publicBase + "/Build/" + FindBuildFile(buildDirectory, "*.data"),
                frameworkUrl = publicBase + "/Build/" + FindBuildFile(buildDirectory, "*.framework.js"),
                codeUrl = publicBase + "/Build/" + FindBuildFile(buildDirectory, "*.wasm"),
                streamingAssetsUrl = publicBase + "/StreamingAssets"
            };
            File.WriteAllText(
                Path.Combine(outputPath, "build-manifest.json"),
                JsonUtility.ToJson(manifest, true) + Environment.NewLine);
        }

        private static string FindBuildFile(string directory, string pattern)
        {
            var matches = Directory.GetFiles(directory, pattern, SearchOption.TopDirectoryOnly);
            if (matches.Length != 1)
            {
                throw new InvalidOperationException(
                    "Expected exactly one Unity build file matching " + pattern + ", found " + matches.Length);
            }
            if (new FileInfo(matches[0]).Length <= 0)
            {
                throw new InvalidOperationException("Unity build file is empty: " + matches[0]);
            }
            return Path.GetFileName(matches[0]);
        }
    }
}
