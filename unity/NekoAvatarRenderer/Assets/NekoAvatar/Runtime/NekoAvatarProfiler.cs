using System;
using System.Collections.Generic;
using UniVRM10;
using UnityEngine;

namespace Neko.Avatar
{
    [Serializable]
    public sealed class NekoAvatarGeometryProfile
    {
        public int meshCount;
        public int vertices;
        public int faces;
        public int morphTargetCount;
    }

    [Serializable]
    public sealed class NekoAvatarMaterialProfile
    {
        public int count;
        public int textureCount;
    }

    [Serializable]
    public sealed class NekoAvatarSkeletonProfile
    {
        public int boneCount;
        public int humanBoneCount;
    }

    [Serializable]
    public sealed class NekoAvatarSpringBoneProfile
    {
        public int springCount;
        public int jointCount;
        public int colliderGroupCount;
        public int colliderCount;
    }

    [Serializable]
    public sealed class NekoAvatarProfileSize
    {
        public float width;
        public float height;
    }

    [Serializable]
    public sealed class NekoAvatarRendererProfile
    {
        public int rendererCount;
        public int materialSlotCount;
        public int drawCalls;
        public bool drawCallsEstimated;
        public string drawCallEstimateMethod;
        public int triangles;
        public int textures;
        public int geometries;
        public NekoAvatarProfileSize size;
    }

    [Serializable]
    public sealed class NekoAvatarProfileSnapshot
    {
        public string type = "vrm";
        public bool loaded = true;
        public string name;
        public NekoAvatarGeometryProfile geometry;
        public NekoAvatarMaterialProfile materials;
        public NekoAvatarSkeletonProfile skeleton;
        public NekoAvatarSpringBoneProfile springBones;
        public NekoAvatarRendererProfile renderer;
    }

    public static class NekoAvatarProfiler
    {
        public const string DrawCallEstimateMethod = "sum_renderer_material_shader_passes";

        public static NekoAvatarProfileSnapshot Capture(
            Vrm10Instance avatar,
            string modelName,
            float surfaceWidth,
            float surfaceHeight)
        {
            if (avatar == null) throw new ArgumentNullException(nameof(avatar));

            var meshes = new HashSet<Mesh>();
            var materials = new HashSet<Material>();
            var textures = new HashSet<Texture>();
            var bones = new HashSet<Transform>();
            long vertices = 0;
            long faces = 0;
            long morphTargets = 0;
            long materialSlots = 0;
            long drawCallEstimate = 0;

            var renderers = avatar.GetComponentsInChildren<Renderer>(true);
            foreach (var renderer in renderers)
            {
                var mesh = GetSharedMesh(renderer);
                if (mesh != null && meshes.Add(mesh))
                {
                    vertices += Math.Max(0, mesh.vertexCount);
                    morphTargets += Math.Max(0, mesh.blendShapeCount);
                    for (var index = 0; index < mesh.subMeshCount; ++index)
                    {
                        if (mesh.GetTopology(index) == MeshTopology.Triangles)
                        {
                            faces += mesh.GetIndexCount(index) / 3u;
                        }
                    }
                }

                if (renderer is SkinnedMeshRenderer skinned)
                {
                    foreach (var bone in skinned.bones)
                    {
                        if (bone != null) bones.Add(bone);
                    }
                }

                foreach (var material in renderer.sharedMaterials)
                {
                    if (material == null) continue;
                    ++materialSlots;
                    drawCallEstimate += Math.Max(1, material.passCount);
                    materials.Add(material);
                }
            }

            foreach (var material in materials)
            {
                foreach (var propertyName in material.GetTexturePropertyNames())
                {
                    var texture = material.GetTexture(propertyName);
                    if (texture != null) textures.Add(texture);
                }
            }

            var humanBoneCount = 0;
            var animator = avatar.GetComponent<Animator>();
            if (animator != null && animator.isHuman)
            {
                for (var index = 0; index < (int)HumanBodyBones.LastBone; ++index)
                {
                    if (animator.GetBoneTransform((HumanBodyBones)index) != null) ++humanBoneCount;
                }
            }

            var springCount = 0;
            var springJoints = new HashSet<VRM10SpringBoneJoint>();
            var colliderGroups = new HashSet<VRM10SpringBoneColliderGroup>();
            var colliders = new HashSet<VRM10SpringBoneCollider>();
            var springBone = avatar.SpringBone;
            if (springBone != null)
            {
                if (springBone.Springs != null)
                {
                    foreach (var spring in springBone.Springs)
                    {
                        if (spring == null) continue;
                        ++springCount;
                        if (spring.Joints == null) continue;
                        foreach (var joint in spring.Joints)
                        {
                            if (joint != null) springJoints.Add(joint);
                        }
                    }
                }
                if (springBone.ColliderGroups != null)
                {
                    foreach (var group in springBone.ColliderGroups)
                    {
                        if (group == null || !colliderGroups.Add(group) || group.Colliders == null) continue;
                        foreach (var collider in group.Colliders)
                        {
                            if (collider != null) colliders.Add(collider);
                        }
                    }
                }
            }

            var geometry = new NekoAvatarGeometryProfile
            {
                meshCount = meshes.Count,
                vertices = Saturate(vertices),
                faces = Saturate(faces),
                morphTargetCount = Saturate(morphTargets)
            };
            var materialProfile = new NekoAvatarMaterialProfile
            {
                count = materials.Count,
                textureCount = textures.Count
            };
            return new NekoAvatarProfileSnapshot
            {
                name = modelName ?? string.Empty,
                geometry = geometry,
                materials = materialProfile,
                skeleton = new NekoAvatarSkeletonProfile
                {
                    boneCount = bones.Count,
                    humanBoneCount = humanBoneCount
                },
                springBones = new NekoAvatarSpringBoneProfile
                {
                    springCount = springCount,
                    jointCount = springJoints.Count,
                    colliderGroupCount = colliderGroups.Count,
                    colliderCount = colliders.Count
                },
                renderer = new NekoAvatarRendererProfile
                {
                    rendererCount = renderers.Length,
                    materialSlotCount = Saturate(materialSlots),
                    drawCalls = Saturate(drawCallEstimate),
                    drawCallsEstimated = true,
                    drawCallEstimateMethod = DrawCallEstimateMethod,
                    triangles = geometry.faces,
                    textures = materialProfile.textureCount,
                    geometries = geometry.meshCount,
                    size = new NekoAvatarProfileSize
                    {
                        width = Math.Max(1f, surfaceWidth),
                        height = Math.Max(1f, surfaceHeight)
                    }
                }
            };
        }

        private static Mesh GetSharedMesh(Renderer renderer)
        {
            if (renderer is SkinnedMeshRenderer skinned) return skinned.sharedMesh;
            if (renderer is MeshRenderer meshRenderer)
            {
                var filter = meshRenderer.GetComponent<MeshFilter>();
                return filter != null ? filter.sharedMesh : null;
            }
            return null;
        }

        private static int Saturate(long value)
        {
            if (value <= 0) return 0;
            return value >= int.MaxValue ? int.MaxValue : (int)value;
        }
    }
}
