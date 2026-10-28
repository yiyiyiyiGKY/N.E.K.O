using System;
using System.Collections.Generic;
using UnityEngine;

namespace Neko.Avatar
{
    internal sealed class NekoAvatarAccessoryResource
    {
        public string Id;
        public GameObject Root;
        public readonly Dictionary<string, Transform> Anchors =
            new Dictionary<string, Transform>(StringComparer.Ordinal);
        public readonly List<Material> Materials = new List<Material>();
        public readonly List<Mesh> Meshes = new List<Mesh>();

        public void Release()
        {
            if (Root != null) UnityEngine.Object.Destroy(Root);
            foreach (var material in Materials)
            {
                if (material != null) UnityEngine.Object.Destroy(material);
            }
            foreach (var mesh in Meshes)
            {
                if (mesh != null) UnityEngine.Object.Destroy(mesh);
            }
            Root = null;
            Materials.Clear();
            Meshes.Clear();
            Anchors.Clear();
        }
    }

    internal static class NekoAvatarAccessoryFactory
    {
        public const string BadmintonRacket = "badmintonRacket";
        public const string BadmintonShuttle = "badmintonShuttle";

        public static bool IsSupportedPreset(string value)
        {
            return value == BadmintonRacket || value == BadmintonShuttle;
        }

        public static NekoAvatarAccessoryResource Create(string id, string preset)
        {
            if (!IsSupportedPreset(preset)) throw new ArgumentException("Unsupported accessory preset", nameof(preset));
            var result = new NekoAvatarAccessoryResource
            {
                Id = id,
                Root = new GameObject("NekoAccessory-" + id)
            };
            try
            {
                if (preset == BadmintonRacket) BuildRacket(result);
                else BuildShuttle(result);
                return result;
            }
            catch
            {
                result.Release();
                throw;
            }
        }

        private static void BuildRacket(NekoAvatarAccessoryResource result)
        {
            var frame = CreateMaterial(result, new Color(0.89f, 0.97f, 1f, 1f));
            var grip = CreateMaterial(result, new Color(0.24f, 0.34f, 0.39f, 1f));
            var strings = CreateMaterial(result, new Color(0.68f, 0.82f, 0.88f, 1f));
            CreateCylinder(result.Root.transform, "Handle", 0.0108f, 0.172f, new Vector3(0f, 0f, 0f), Quaternion.identity, grip);
            CreateCylinder(result.Root.transform, "Shaft", 0.0032f, 0.31f, new Vector3(0f, 0.235f, 0f), Quaternion.identity, frame);
            CreateTorus(result, "Head", 0.082f, 0.0042f, new Vector3(0f, 0.475f, 0f), new Vector3(0.68f, 1.28f, 1f), frame);
            for (var index = -4; index <= 4; ++index)
            {
                CreateCylinder(
                    result.Root.transform,
                    "StringVertical",
                    0.00055f,
                    0.19f,
                    new Vector3(index * 0.0105f, 0.475f, 0.001f),
                    Quaternion.identity,
                    strings);
                CreateCylinder(
                    result.Root.transform,
                    "StringHorizontal",
                    0.00055f,
                    0.098f,
                    new Vector3(0f, 0.475f + index * 0.021f, 0.002f),
                    Quaternion.Euler(0f, 0f, 90f),
                    strings);
            }
            AddAnchor(result, "sweetSpot", new Vector3(0f, 0.475f, 0.002f));
        }

        private static void BuildShuttle(NekoAvatarAccessoryResource result)
        {
            var cork = CreateMaterial(result, new Color(0.93f, 0.91f, 0.79f, 1f));
            var feather = CreateMaterial(result, new Color(0.96f, 0.98f, 1f, 1f));
            CreateSphere(result.Root.transform, "Cork", new Vector3(0f, -0.018f, 0f), new Vector3(0.032f, 0.042f, 0.032f), cork);
            CreateTorus(result, "FeatherRing", 0.035f, 0.002f, new Vector3(0f, 0.07f, 0f), Vector3.one, feather);
            for (var index = 0; index < 8; ++index)
            {
                var angle = index * Mathf.PI * 2f / 8f;
                var end = new Vector3(Mathf.Cos(angle) * 0.035f, 0.07f, Mathf.Sin(angle) * 0.035f);
                CreateCylinderBetween(result.Root.transform, "Feather", new Vector3(0f, 0.002f, 0f), end, 0.0012f, feather);
            }
            AddAnchor(result, "origin", Vector3.zero);
        }

        private static Material CreateMaterial(NekoAvatarAccessoryResource result, Color color)
        {
            var shader = Shader.Find("UniGLTF/UniUnlit");
            if (shader == null) throw new InvalidOperationException("UniGLTF/UniUnlit shader is unavailable");
            var material = new Material(shader) { name = "NekoAccessoryMaterial" };
            if (material.HasProperty("_Color")) material.SetColor("_Color", color);
            result.Materials.Add(material);
            return material;
        }

        private static void CreateCylinder(
            Transform parent,
            string name,
            float radius,
            float height,
            Vector3 position,
            Quaternion rotation,
            Material material)
        {
            var item = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            item.name = name;
            item.transform.SetParent(parent, false);
            item.transform.localPosition = position;
            item.transform.localRotation = rotation;
            item.transform.localScale = new Vector3(radius * 2f, height * 0.5f, radius * 2f);
            var renderer = item.GetComponent<MeshRenderer>();
            renderer.sharedMaterial = material;
            var collider = item.GetComponent<Collider>();
            if (collider != null) UnityEngine.Object.Destroy(collider);
        }

        private static void CreateCylinderBetween(
            Transform parent,
            string name,
            Vector3 start,
            Vector3 end,
            float radius,
            Material material)
        {
            var direction = end - start;
            CreateCylinder(
                parent,
                name,
                radius,
                direction.magnitude,
                (start + end) * 0.5f,
                Quaternion.FromToRotation(Vector3.up, direction.normalized),
                material);
        }

        private static void CreateSphere(
            Transform parent,
            string name,
            Vector3 position,
            Vector3 scale,
            Material material)
        {
            var item = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            item.name = name;
            item.transform.SetParent(parent, false);
            item.transform.localPosition = position;
            item.transform.localScale = scale;
            item.GetComponent<MeshRenderer>().sharedMaterial = material;
            var collider = item.GetComponent<Collider>();
            if (collider != null) UnityEngine.Object.Destroy(collider);
        }

        private static void CreateTorus(
            NekoAvatarAccessoryResource result,
            string name,
            float majorRadius,
            float tubeRadius,
            Vector3 position,
            Vector3 scale,
            Material material)
        {
            const int majorSegments = 48;
            const int tubeSegments = 8;
            var vertices = new Vector3[majorSegments * tubeSegments];
            var normals = new Vector3[vertices.Length];
            var triangles = new int[majorSegments * tubeSegments * 6];
            for (var major = 0; major < majorSegments; ++major)
            {
                var u = major * Mathf.PI * 2f / majorSegments;
                var radial = new Vector3(Mathf.Cos(u), Mathf.Sin(u), 0f);
                for (var tube = 0; tube < tubeSegments; ++tube)
                {
                    var v = tube * Mathf.PI * 2f / tubeSegments;
                    var normal = radial * Mathf.Cos(v) + Vector3.forward * Mathf.Sin(v);
                    var vertexIndex = major * tubeSegments + tube;
                    vertices[vertexIndex] = radial * majorRadius + normal * tubeRadius;
                    normals[vertexIndex] = normal;
                    var nextMajor = (major + 1) % majorSegments;
                    var nextTube = (tube + 1) % tubeSegments;
                    var triangleIndex = vertexIndex * 6;
                    triangles[triangleIndex] = vertexIndex;
                    triangles[triangleIndex + 1] = nextMajor * tubeSegments + tube;
                    triangles[triangleIndex + 2] = nextMajor * tubeSegments + nextTube;
                    triangles[triangleIndex + 3] = vertexIndex;
                    triangles[triangleIndex + 4] = nextMajor * tubeSegments + nextTube;
                    triangles[triangleIndex + 5] = major * tubeSegments + nextTube;
                }
            }
            var mesh = new Mesh { name = "NekoAccessoryTorus" };
            mesh.vertices = vertices;
            mesh.normals = normals;
            mesh.triangles = triangles;
            mesh.RecalculateBounds();
            result.Meshes.Add(mesh);

            var item = new GameObject(name);
            item.transform.SetParent(result.Root.transform, false);
            item.transform.localPosition = position;
            item.transform.localScale = scale;
            item.AddComponent<MeshFilter>().sharedMesh = mesh;
            item.AddComponent<MeshRenderer>().sharedMaterial = material;
        }

        internal static Transform AddAnchor(NekoAvatarAccessoryResource result, string name, Vector3 position)
        {
            if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Accessory anchor requires a name", nameof(name));
            if (result.Anchors.ContainsKey(name)) throw new InvalidOperationException("Duplicate accessory anchor: " + name);
            var anchor = new GameObject("Anchor-" + name).transform;
            anchor.SetParent(result.Root.transform, false);
            anchor.localPosition = position;
            result.Anchors.Add(name, anchor);
            return anchor;
        }
    }
}
