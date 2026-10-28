using System;
using System.Globalization;

namespace Neko.Avatar
{
    public static class NekoAvatarProtocol
    {
        public const int Version = 1;
        public const string ControllerObjectName = "NekoAvatarRuntime";
        public const string ModelOrientationCommand = "model.orientation";
        public const string SurfaceSyncCommand = "surface.sync";
        public const float DefaultMinVisiblePixels = 200f;
        public const float OrbitRadiansPerPixel = 0.005f;
        public const float InitialAnimationFallbackSeconds = 1f;
        public const float InitialAnimationHardFallbackSeconds = 2f;

        public static float Clamp01(float value)
        {
            if (float.IsNaN(value) || float.IsInfinity(value)) return 0f;
            if (value <= 0f) return 0f;
            if (value >= 1f) return 1f;
            return value;
        }

        public static bool TryNormalizeAssetUrl(string value, out string normalized)
        {
            normalized = null;
            if (string.IsNullOrWhiteSpace(value)) return false;

            var candidate = value.Trim();
            if (candidate.StartsWith("/", StringComparison.Ordinal) &&
                !candidate.StartsWith("//", StringComparison.Ordinal))
            {
                normalized = candidate;
                return true;
            }

            const string blobPrefix = "blob:";
            if (candidate.StartsWith(blobPrefix, StringComparison.OrdinalIgnoreCase))
            {
                var origin = candidate.Substring(blobPrefix.Length);
                if (!Uri.TryCreate(origin, UriKind.Absolute, out var originUri)) return false;
                if (originUri.Scheme != Uri.UriSchemeHttp && originUri.Scheme != Uri.UriSchemeHttps) return false;
                normalized = candidate;
                return true;
            }

            if (!Uri.TryCreate(candidate, UriKind.Absolute, out var uri)) return false;
            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) return false;

            normalized = uri.AbsoluteUri;
            return true;
        }

        public static string NormalizeExpressionName(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;
            var normalized = value.Trim().Replace("_", string.Empty).Replace("-", string.Empty).ToLowerInvariant();
            switch (normalized)
            {
                case "joy": return "happy";
                case "fun": return "relaxed";
                case "sorrow": return "sad";
                case "surprise": return "surprised";
                case "a": return "aa";
                case "i": return "ih";
                case "u": return "ou";
                case "e": return "ee";
                case "o": return "oh";
                default: return normalized;
            }
        }

        public static bool TryParseInvariantFloat(string value, out float parsed)
        {
            return float.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out parsed) &&
                   !float.IsNaN(parsed) &&
                   !float.IsInfinity(parsed);
        }

        public static float NormalizePlaybackSpeed(float value)
        {
            if (float.IsNaN(value) || float.IsInfinity(value) || value <= 0f) return 1f;
            return Math.Min(4f, Math.Max(0.05f, value));
        }

        public static bool TryNormalizeTargetFrameRate(int value, out int normalized)
        {
            normalized = -1;
            if (value < 0) return false;
            if (value == 0) return true;
            normalized = Math.Min(120, Math.Max(15, value));
            return true;
        }

        public static bool TryNormalizeZoomFactor(float value, out float normalized)
        {
            normalized = 1f;
            if (float.IsNaN(value) || float.IsInfinity(value) || value <= 0f) return false;
            normalized = Math.Min(5f, Math.Max(0.2f, value));
            return true;
        }

        public static float NormalizeMinVisiblePixels(float value)
        {
            if (float.IsNaN(value) || float.IsInfinity(value) || value <= 0f)
            {
                return DefaultMinVisiblePixels;
            }
            return value;
        }

        public static float CalculateVisibilityCorrection(
            float modelMin,
            float modelMax,
            float surfaceSize,
            float minVisiblePixels)
        {
            if (float.IsNaN(modelMin) || float.IsInfinity(modelMin) ||
                float.IsNaN(modelMax) || float.IsInfinity(modelMax) ||
                float.IsNaN(surfaceSize) || float.IsInfinity(surfaceSize) ||
                surfaceSize <= 0f || modelMax <= modelMin)
            {
                return 0f;
            }

            var effectiveMinimum = Math.Min(
                NormalizeMinVisiblePixels(minVisiblePixels),
                surfaceSize);
            var visibleMinimum = Math.Max(0f, modelMin);
            var visibleMaximum = Math.Min(surfaceSize, modelMax);
            var visibleSize = Math.Max(0f, visibleMaximum - visibleMinimum);
            var overflows = modelMin < 0f || modelMax > surfaceSize;
            if (!overflows || visibleSize >= effectiveMinimum) return 0f;

            if (modelMax < effectiveMinimum) return effectiveMinimum - modelMax;
            var maximumAllowedMinimum = surfaceSize - effectiveMinimum;
            if (modelMin > maximumAllowedMinimum) return maximumAllowedMinimum - modelMin;
            return 0f;
        }

        public static float EaseOutBack(float progress)
        {
            var value = Math.Min(1f, Math.Max(0f, progress));
            const float c1 = 1.70158f;
            const float c3 = c1 + 1f;
            var offset = value - 1f;
            return 1f + c3 * offset * offset * offset + c1 * offset * offset;
        }

        public static UnityEngine.Quaternion CalculateOrbitDelta(float totalX, float totalY)
        {
            if (float.IsNaN(totalX) || float.IsInfinity(totalX) ||
                float.IsNaN(totalY) || float.IsInfinity(totalY))
            {
                return UnityEngine.Quaternion.identity;
            }
            var yaw = UnityEngine.Quaternion.AngleAxis(
                totalX * OrbitRadiansPerPixel * UnityEngine.Mathf.Rad2Deg,
                UnityEngine.Vector3.up);
            var pitch = UnityEngine.Quaternion.AngleAxis(
                totalY * OrbitRadiansPerPixel * UnityEngine.Mathf.Rad2Deg,
                UnityEngine.Vector3.right);
            return yaw * pitch;
        }

        public static float GetWorldYaw(UnityEngine.Quaternion rotation)
        {
            var forward = rotation * UnityEngine.Vector3.forward;
            if (forward.x * forward.x + forward.z * forward.z <= 0.00000001f)
            {
                forward = rotation * UnityEngine.Vector3.right;
                return (float)Math.Atan2(-forward.z, forward.x);
            }
            return (float)Math.Atan2(forward.x, forward.z);
        }

        public static float ShortestAngleDelta(float from, float to)
        {
            if (float.IsNaN(from) || float.IsInfinity(from) ||
                float.IsNaN(to) || float.IsInfinity(to)) return 0f;
            var delta = to - from;
            while (delta > Math.PI) delta -= (float)(Math.PI * 2.0);
            while (delta < -Math.PI) delta += (float)(Math.PI * 2.0);
            return delta;
        }

        public static bool TryNeedsFacingCorrection(
            UnityEngine.Vector3 avatarFacing,
            UnityEngine.Vector3 targetFacing,
            out bool needsRotation)
        {
            needsRotation = false;
            avatarFacing.y = 0f;
            targetFacing.y = 0f;
            if (!IsFiniteVector(avatarFacing) || !IsFiniteVector(targetFacing) ||
                avatarFacing.sqrMagnitude <= 0.000001f || targetFacing.sqrMagnitude <= 0.000001f)
            {
                return false;
            }

            var alignment = UnityEngine.Vector3.Dot(
                avatarFacing.normalized,
                targetFacing.normalized);
            // Near-perpendicular results do not contain enough evidence for an
            // automatic 180-degree correction.
            if (UnityEngine.Mathf.Abs(alignment) < 0.1f) return false;
            needsRotation = alignment < 0f;
            return true;
        }

        public static UnityEngine.Vector3 SuggestFacingRotation(
            UnityEngine.Vector3 currentEulerRadians,
            bool needsRotation)
        {
            if (!IsFiniteVector(currentEulerRadians)) return UnityEngine.Vector3.zero;
            if (!needsRotation) return currentEulerRadians;
            currentEulerRadians.y = UnityEngine.Mathf.DeltaAngle(
                0f,
                currentEulerRadians.y * UnityEngine.Mathf.Rad2Deg + 180f) * UnityEngine.Mathf.Deg2Rad;
            return currentEulerRadians;
        }

        public static float CalculateMovementVelocity(
            float currentVelocity,
            float distance,
            float deltaTime,
            float maxSpeed,
            float acceleration,
            float deceleration,
            float arrivalThreshold)
        {
            var velocity = Math.Max(0f, currentVelocity);
            var speedLimit = Math.Max(0f, maxSpeed);
            var time = Math.Max(0f, deltaTime);
            var braking = Math.Max(0.001f, deceleration);
            var brakingDistance = velocity * velocity / (2f * braking);
            if (distance <= brakingDistance + Math.Max(0f, arrivalThreshold))
            {
                return Math.Max(0f, velocity - braking * time);
            }
            return Math.Min(speedLimit, velocity + Math.Max(0f, acceleration) * time);
        }

        public static float NormalizeMovementMaxSpeed(float value)
        {
            if (float.IsNaN(value) || float.IsInfinity(value) || value <= 0f) return 0f;
            return Math.Min(0.9f, value);
        }

        public static float NormalizePositiveMovementValue(float value, float fallback)
        {
            if (float.IsNaN(value) || float.IsInfinity(value) || value <= 0f) return fallback;
            return value;
        }

        public static string ToVrmHumanBoneName(string animatorBoneName)
        {
            switch (animatorBoneName)
            {
                // Unity 2022 names the thumb metacarpal "Proximal" and the
                // VRM proximal phalanx "Intermediate". VMC uses VRM names.
                case "LeftThumbProximal": return "LeftThumbMetacarpal";
                case "LeftThumbIntermediate": return "LeftThumbProximal";
                case "RightThumbProximal": return "RightThumbMetacarpal";
                case "RightThumbIntermediate": return "RightThumbProximal";
                default: return animatorBoneName ?? string.Empty;
            }
        }

        public static bool TryParseHumanBoneName(string value, out UnityEngine.HumanBodyBones bone)
        {
            bone = UnityEngine.HumanBodyBones.LastBone;
            if (string.IsNullOrWhiteSpace(value)) return false;
            var normalized = value.Trim();
            switch (normalized.ToLowerInvariant())
            {
                case "leftthumbmetacarpal": bone = UnityEngine.HumanBodyBones.LeftThumbProximal; return true;
                case "leftthumbproximal": bone = UnityEngine.HumanBodyBones.LeftThumbIntermediate; return true;
                case "rightthumbmetacarpal": bone = UnityEngine.HumanBodyBones.RightThumbProximal; return true;
                case "rightthumbproximal": bone = UnityEngine.HumanBodyBones.RightThumbIntermediate; return true;
            }
            normalized = char.ToUpperInvariant(normalized[0]) + normalized.Substring(1);
            return Enum.TryParse(normalized, false, out bone) && bone != UnityEngine.HumanBodyBones.LastBone;
        }

        public static bool IsFiniteVector(UnityEngine.Vector3 value)
        {
            return !float.IsNaN(value.x) && !float.IsInfinity(value.x) &&
                   !float.IsNaN(value.y) && !float.IsInfinity(value.y) &&
                   !float.IsNaN(value.z) && !float.IsInfinity(value.z);
        }

        public static float ViewportToCanvas(float viewportValue, float canvasSize, bool invert)
        {
            var normalized = invert ? 1f - viewportValue : viewportValue;
            return normalized * Math.Max(1f, canvasSize);
        }

        public static UnityEngine.Vector3 UnityToBrowserPosition(UnityEngine.Vector3 value)
        {
            return new UnityEngine.Vector3(value.x, value.y, -value.z);
        }

        public static UnityEngine.Quaternion UnityToBrowserRotation(UnityEngine.Quaternion value)
        {
            return new UnityEngine.Quaternion(-value.x, -value.y, value.z, value.w);
        }

        public static string NormalizeQualityPreset(string value)
        {
            var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
            switch (normalized)
            {
                case "low":
                case "medium":
                case "high":
                    return normalized;
                default:
                    return string.Empty;
            }
        }

        public static string NormalizeFitMode(string value)
        {
            var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
            switch (normalized)
            {
                case "contain":
                case "cover":
                case "native":
                case "width":
                case "height":
                    return normalized;
                default:
                    return "contain";
            }
        }

        public static float CalculateFitPixelsPerUnit(
            string mode,
            float availableWidth,
            float availableHeight,
            float sourceWidth,
            float sourceHeight,
            float nativePixelsPerUnit,
            float scaleMultiplier,
            bool autoScale,
            float minWidth,
            float minHeight)
        {
            if (!IsFinitePositive(sourceWidth) || !IsFinitePositive(sourceHeight) ||
                !IsFinitePositive(availableWidth) || !IsFinitePositive(availableHeight))
            {
                return IsFinitePositive(nativePixelsPerUnit) ? nativePixelsPerUnit : 1f;
            }

            var multiplier = IsFinitePositive(scaleMultiplier) ? scaleMultiplier : 1f;
            var native = IsFinitePositive(nativePixelsPerUnit) ? nativePixelsPerUnit : 1f;
            var normalizedMode = NormalizeFitMode(mode);
            if (!autoScale || normalizedMode == "native") return native * multiplier;

            var widthRatio = availableWidth / sourceWidth;
            var heightRatio = availableHeight / sourceHeight;
            float maximum;
            switch (normalizedMode)
            {
                case "width": maximum = widthRatio; break;
                case "height": maximum = heightRatio; break;
                case "cover": maximum = Math.Max(widthRatio, heightRatio); break;
                default: maximum = Math.Min(widthRatio, heightRatio); break;
            }

            var minimumWidthRatio = Math.Max(0f, minWidth) / sourceWidth;
            var minimumHeightRatio = Math.Max(0f, minHeight) / sourceHeight;
            return Math.Min(
                maximum,
                Math.Max(maximum * multiplier, Math.Max(minimumWidthRatio, minimumHeightRatio)));
        }

        public static bool HasAnimationReachedEnd(float time, float length)
        {
            if (float.IsNaN(time) || float.IsNaN(length)) return false;
            if (length <= 0f) return true;
            return time >= length - 0.0001f;
        }

        public static float ScaleOutlineWidth(float originalWidth, float scale)
        {
            if (float.IsNaN(originalWidth) || float.IsInfinity(originalWidth)) return 0f;
            if (float.IsNaN(scale) || float.IsInfinity(scale)) scale = 1f;
            return Math.Max(0f, originalWidth) * Math.Min(10f, Math.Max(0f, scale));
        }

        public static float CalculateAnimationBlendWeight(
            float startWeight,
            float targetWeight,
            float elapsed,
            float duration)
        {
            var start = Clamp01(startWeight);
            var target = Clamp01(targetWeight);
            if (float.IsNaN(duration) || float.IsInfinity(duration) || duration <= 0f) return target;
            var progress = Clamp01(elapsed / duration);
            return start + (target - start) * progress;
        }

        public static UnityEngine.Quaternion AccumulateAnimationRotation(
            UnityEngine.Quaternion accumulated,
            float accumulatedWeight,
            UnityEngine.Quaternion incoming,
            float incomingWeight,
            out float totalWeight)
        {
            var currentWeight = Math.Max(0f, accumulatedWeight);
            var nextWeight = Math.Max(0f, incomingWeight);
            totalWeight = currentWeight + nextWeight;
            if (nextWeight <= 0f) return accumulated;
            if (currentWeight <= 0f) return incoming;
            return UnityEngine.Quaternion.Slerp(
                accumulated,
                incoming,
                nextWeight / totalWeight);
        }

        public static UnityEngine.Quaternion FinalizeAnimationRotation(
            UnityEngine.Quaternion accumulated,
            float accumulatedWeight)
        {
            if (!(accumulatedWeight > 0f)) return UnityEngine.Quaternion.identity;
            if (accumulatedWeight >= 1f) return accumulated;
            return UnityEngine.Quaternion.Slerp(
                accumulated,
                UnityEngine.Quaternion.identity,
                1f - accumulatedWeight);
        }

        public static UnityEngine.Vector3 RetargetAnimationHipsToReference(
            UnityEngine.Vector3 rawHips,
            UnityEngine.Vector3 sourceRestHips,
            UnityEngine.Vector3 referenceRestHips)
        {
            if (!IsFiniteVector(rawHips) || !IsFiniteVector(sourceRestHips) ||
                !IsFiniteVector(referenceRestHips))
            {
                return referenceRestHips;
            }
            var sourceHeight = sourceRestHips.y;
            var referenceHeight = referenceRestHips.y;
            var scale = Math.Abs(sourceHeight) > 0.00001f && Math.Abs(referenceHeight) > 0.00001f
                ? referenceHeight / sourceHeight
                : 1f;
            return referenceRestHips + (rawHips - sourceRestHips) * scale;
        }

        public static UnityEngine.Vector3 AccumulateAnimationVector(
            UnityEngine.Vector3 accumulated,
            float accumulatedWeight,
            UnityEngine.Vector3 incoming,
            float incomingWeight,
            out float totalWeight)
        {
            var currentWeight = Math.Max(0f, accumulatedWeight);
            var nextWeight = Math.Max(0f, incomingWeight);
            totalWeight = currentWeight + nextWeight;
            if (nextWeight <= 0f) return accumulated;
            if (currentWeight <= 0f) return incoming;
            return UnityEngine.Vector3.LerpUnclamped(
                accumulated,
                incoming,
                nextWeight / totalWeight);
        }

        public static UnityEngine.Vector3 FinalizeAnimationVector(
            UnityEngine.Vector3 accumulated,
            float accumulatedWeight,
            UnityEngine.Vector3 original)
        {
            if (!(accumulatedWeight > 0f)) return original;
            if (accumulatedWeight >= 1f) return accumulated;
            return UnityEngine.Vector3.LerpUnclamped(
                accumulated,
                original,
                1f - accumulatedWeight);
        }

        public static float FinalizeAnimationScalar(
            float weightedSum,
            float accumulatedWeight,
            float originalValue = 0f)
        {
            var original = Clamp01(originalValue);
            if (!(accumulatedWeight > 0f) || float.IsNaN(weightedSum) || float.IsInfinity(weightedSum))
            {
                return original;
            }
            var value = accumulatedWeight > 1f ? weightedSum / accumulatedWeight : weightedSum;
            if (accumulatedWeight < 1f) value += original * (1f - accumulatedWeight);
            return Clamp01(value);
        }

        private static bool IsFinitePositive(float value)
        {
            return !float.IsNaN(value) && !float.IsInfinity(value) && value > 0f;
        }
    }
}
