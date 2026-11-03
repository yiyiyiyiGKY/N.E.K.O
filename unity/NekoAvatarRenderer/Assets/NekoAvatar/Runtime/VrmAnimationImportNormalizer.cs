using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using UniGLTF;
using UniJSON;
using VrmAnimationSchema = UniGLTF.Extensions.VRMC_vrm_animation;

namespace Neko.Avatar
{
    /// <summary>
    /// Keeps expression nodes removable by UniVRM's VrmAnimationImporter.
    /// UniVRM 0.131.4 removes those nodes without remapping other node indices,
    /// so valid VRMA files with a later scene root otherwise fail at runtime.
    /// </summary>
    internal static class VrmAnimationImportNormalizer
    {
        public static bool Normalize(GltfData data)
        {
            if (data == null) throw new ArgumentNullException(nameof(data));
            var changed = EnsureUniqueNodeNames(data.GLTF.nodes);
            if (!(data.GLTF.extensions is glTFExtensionImport imported)) return changed;

            var extension = ReadExtension(imported);
            var animation = data.GLTF.animations.FirstOrDefault();
            if (extension?.Expressions == null || animation == null) return changed;

            var expressionNodes = EnumerateExpressions(extension.Expressions)
                .Where(expression => expression?.Node != null)
                .Select(expression => expression.Node.Value)
                .Distinct()
                .Select(node => new
                {
                    Node = node,
                    Channel = animation.channels.FindIndex(channel => channel.target.node == node)
                })
                .Where(binding => binding.Channel >= 0)
                .OrderBy(binding => binding.Channel)
                .Select(binding => binding.Node)
                .ToArray();
            if (expressionNodes.Length == 0) return changed;

            var nodeCount = data.GLTF.nodes.Count;
            foreach (var node in expressionNodes)
            {
                ValidateNodeIndex(node, nodeCount, "VRM animation expression");
            }

            var expressionSet = new HashSet<int>(expressionNodes);
            var newToOld = Enumerable.Range(0, nodeCount)
                .Where(index => !expressionSet.Contains(index))
                .Concat(expressionNodes)
                .ToArray();
            var oldToNew = new int[nodeCount];
            for (var newIndex = 0; newIndex < newToOld.Length; ++newIndex)
            {
                oldToNew[newToOld[newIndex]] = newIndex;
            }

            int Remap(int oldIndex, string owner)
            {
                ValidateNodeIndex(oldIndex, nodeCount, owner);
                return oldToNew[oldIndex];
            }

            foreach (var scene in data.GLTF.scenes)
            {
                scene.nodes = RemapArray(scene.nodes, expressionSet, index => Remap(index, "scene"));
            }
            foreach (var node in data.GLTF.nodes)
            {
                node.children = RemapArray(node.children, expressionSet, index => Remap(index, "node child"));
            }
            foreach (var clip in data.GLTF.animations)
            {
                foreach (var channel in clip.channels)
                {
                    channel.target.node = Remap(channel.target.node, "animation channel");
                }
            }
            foreach (var skin in data.GLTF.skins)
            {
                skin.joints = RemapArray(skin.joints, expressionSet, index => Remap(index, "skin joint"));
                if (skin.skeleton >= 0) skin.skeleton = Remap(skin.skeleton, "skin skeleton");
            }

            data.GLTF.nodes = newToOld.Select(index => data.GLTF.nodes[index]).ToList();
            RemapExtension(extension, index => Remap(index, "VRMC_vrm_animation extension"));
            data.GLTF.extensions = RewriteExtension(imported, extension);
            return true;
        }

        private static bool EnsureUniqueNodeNames(IReadOnlyList<glTFNode> nodes)
        {
            if (nodes == null) return false;
            var used = new HashSet<string>(StringComparer.Ordinal);
            var changed = false;
            for (var index = 0; index < nodes.Count; ++index)
            {
                var node = nodes[index];
                var baseName = string.IsNullOrWhiteSpace(node.name) ? "node" : node.name;
                var uniqueName = baseName;
                var suffix = index;
                while (!used.Add(uniqueName)) uniqueName = baseName + "-" + suffix++;
                if (node.name == uniqueName) continue;
                node.name = uniqueName;
                changed = true;
            }
            return changed;
        }

        private static int[] RemapArray(int[] values, HashSet<int> removed, Func<int, int> remap)
        {
            if (values == null) return null;
            return values.Where(index => !removed.Contains(index)).Select(remap).ToArray();
        }

        private static void ValidateNodeIndex(int index, int nodeCount, string owner)
        {
            if (index < 0 || index >= nodeCount)
            {
                throw new InvalidDataException(
                    owner + " references node " + index + ", but the file has " + nodeCount + " nodes");
            }
        }

        private static VrmAnimationSchema.VRMC_vrm_animation ReadExtension(glTFExtensionImport imported)
        {
            foreach (var pair in imported.ObjectItems())
            {
                if (pair.Key.GetString() == VrmAnimationSchema.VRMC_vrm_animation.ExtensionName)
                {
                    return VrmAnimationSchema.GltfDeserializer.Deserialize(pair.Value);
                }
            }
            return null;
        }

        private static glTFExtensionImport RewriteExtension(
            glTFExtensionImport imported,
            VrmAnimationSchema.VRMC_vrm_animation animation)
        {
            glTFExtension rewritten = new glTFExtensionExport();
            var export = (glTFExtensionExport)rewritten;
            foreach (var pair in imported.ObjectItems())
            {
                var key = pair.Key.GetString();
                if (key == VrmAnimationSchema.VRMC_vrm_animation.ExtensionName) continue;
                export.Add(key, new ArraySegment<byte>(pair.Value.Value.Bytes.ToArray()));
            }
            VrmAnimationSchema.GltfSerializer.SerializeTo(ref rewritten, animation);
            return ((glTFExtensionExport)rewritten).Deserialize();
        }

        private static IEnumerable<VrmAnimationSchema.Expression> EnumerateExpressions(
            VrmAnimationSchema.Expressions expressions)
        {
            if (expressions.Preset != null)
            {
                foreach (var field in typeof(VrmAnimationSchema.Preset).GetFields(
                    BindingFlags.Instance | BindingFlags.Public))
                {
                    if (field.GetValue(expressions.Preset) is VrmAnimationSchema.Expression expression)
                    {
                        yield return expression;
                    }
                }
            }
            if (expressions.Custom == null) yield break;
            foreach (var expression in expressions.Custom.Values) yield return expression;
        }

        private static void RemapExtension(
            VrmAnimationSchema.VRMC_vrm_animation animation,
            Func<int, int> remap)
        {
            var humanBones = animation.Humanoid?.HumanBones;
            if (humanBones != null)
            {
                foreach (var field in typeof(VrmAnimationSchema.HumanBones).GetFields(
                    BindingFlags.Instance | BindingFlags.Public))
                {
                    if (field.GetValue(humanBones) is VrmAnimationSchema.HumanBone bone && bone.Node.HasValue)
                    {
                        bone.Node = remap(bone.Node.Value);
                    }
                }
            }
            if (animation.Expressions != null)
            {
                foreach (var expression in EnumerateExpressions(animation.Expressions))
                {
                    if (expression?.Node != null) expression.Node = remap(expression.Node.Value);
                }
            }
            if (animation.LookAt?.Node != null) animation.LookAt.Node = remap(animation.LookAt.Node.Value);
        }
    }
}
