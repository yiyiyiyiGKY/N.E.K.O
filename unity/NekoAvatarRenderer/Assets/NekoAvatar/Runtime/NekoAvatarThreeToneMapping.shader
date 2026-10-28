Shader "Hidden/Neko/ThreeToneMapping"
{
    Properties
    {
        _MainTex ("Source", 2D) = "white" {}
        _Mode ("Three.js Tone Mapping Mode", Float) = 7
        _Exposure ("Exposure", Float) = 1.1
    }

    SubShader
    {
        Cull Off
        ZWrite Off
        ZTest Always
        Blend Off

        Pass
        {
            CGPROGRAM
            #pragma vertex vert_img
            #pragma fragment frag
            #pragma target 3.0

            #include "UnityCG.cginc"

            sampler2D _MainTex;
            float _Mode;
            float _Exposure;

            float3 Saturate3(float3 value)
            {
                return clamp(value, 0.0, 1.0);
            }

            float3 LinearToneMapping(float3 color)
            {
                return Saturate3(_Exposure * color);
            }

            float3 ReinhardToneMapping(float3 color)
            {
                color *= _Exposure;
                return Saturate3(color / (1.0 + color));
            }

            float3 CineonToneMapping(float3 color)
            {
                color *= _Exposure;
                color = max(0.0, color - 0.004);
                return pow(
                    (color * (6.2 * color + 0.5)) /
                    (color * (6.2 * color + 1.7) + 0.06),
                    2.2);
            }

            float3 RRTAndODTFit(float3 value)
            {
                float3 numerator = value * (value + 0.0245786) - 0.000090537;
                float3 denominator = value * (0.983729 * value + 0.4329510) + 0.238081;
                return numerator / denominator;
            }

            // Three.js constructs GLSL mat3 values from columns. These helpers
            // spell out the transposed row dot-products explicitly so HLSL
            // packing conventions cannot silently transpose the color spaces.
            float3 AcesInput(float3 color)
            {
                return float3(
                    dot(float3(0.59719, 0.35458, 0.04823), color),
                    dot(float3(0.07600, 0.90834, 0.01566), color),
                    dot(float3(0.02840, 0.13383, 0.83777), color));
            }

            float3 AcesOutput(float3 color)
            {
                return float3(
                    dot(float3(1.60475, -0.53108, -0.07367), color),
                    dot(float3(-0.10208, 1.10813, -0.00605), color),
                    dot(float3(-0.00327, -0.07276, 1.07602), color));
            }

            float3 ACESFilmicToneMapping(float3 color)
            {
                color *= _Exposure / 0.6;
                color = AcesInput(color);
                color = RRTAndODTFit(color);
                color = AcesOutput(color);
                return Saturate3(color);
            }

            float3 LinearSrgbToLinearRec2020(float3 color)
            {
                return float3(
                    dot(float3(0.6274, 0.3293, 0.0433), color),
                    dot(float3(0.0691, 0.9195, 0.0113), color),
                    dot(float3(0.0164, 0.0880, 0.8956), color));
            }

            float3 LinearRec2020ToLinearSrgb(float3 color)
            {
                return float3(
                    dot(float3(1.6605, -0.5876, -0.0728), color),
                    dot(float3(-0.1246, 1.1329, -0.0083), color),
                    dot(float3(-0.0182, -0.1006, 1.1187), color));
            }

            float3 AgxInset(float3 color)
            {
                return float3(
                    dot(float3(0.856627153315983, 0.0951212405381588, 0.0482516061458583), color),
                    dot(float3(0.137318972929847, 0.761241990602591, 0.101439036467562), color),
                    dot(float3(0.11189821299995, 0.0767994186031903, 0.811302368396859), color));
            }

            float3 AgxOutset(float3 color)
            {
                return float3(
                    dot(float3(1.1271005818144368, -0.11060664309660323, -0.016493938717834573), color),
                    dot(float3(-0.1413297634984383, 1.157823702216272, -0.016493938717834257), color),
                    dot(float3(-0.14132976349843826, -0.11060664309660294, 1.2519364065950405), color));
            }

            float3 AgxDefaultContrastApprox(float3 value)
            {
                float3 squared = value * value;
                float3 fourth = squared * squared;
                return 15.5 * fourth * squared
                    - 40.14 * fourth * value
                    + 31.96 * fourth
                    - 6.868 * squared * value
                    + 0.4298 * squared
                    + 0.1191 * value
                    - 0.00232;
            }

            float3 AgXToneMapping(float3 color)
            {
                const float AgxMinEv = -12.47393;
                const float AgxMaxEv = 4.026069;
                color *= _Exposure;
                color = LinearSrgbToLinearRec2020(color);
                color = AgxInset(color);
                color = max(color, 1e-10);
                color = log2(color);
                color = (color - AgxMinEv) / (AgxMaxEv - AgxMinEv);
                color = clamp(color, 0.0, 1.0);
                color = AgxDefaultContrastApprox(color);
                color = AgxOutset(color);
                color = pow(max(0.0, color), 2.2);
                color = LinearRec2020ToLinearSrgb(color);
                return clamp(color, 0.0, 1.0);
            }

            float3 NeutralToneMapping(float3 color)
            {
                const float StartCompression = 0.8 - 0.04;
                const float Desaturation = 0.15;
                color *= _Exposure;
                float minimum = min(color.r, min(color.g, color.b));
                float offset = minimum < 0.08 ? minimum - 6.25 * minimum * minimum : 0.04;
                color -= offset;
                float peak = max(color.r, max(color.g, color.b));
                if (peak < StartCompression) return color;
                float distance = 1.0 - StartCompression;
                float newPeak = 1.0 - distance * distance / (peak + distance - StartCompression);
                color *= newPeak / peak;
                float desaturationWeight = 1.0 - 1.0 / (Desaturation * (peak - newPeak) + 1.0);
                return lerp(color, float3(newPeak, newPeak, newPeak), desaturationWeight);
            }

            float3 ApplyToneMapping(float3 color)
            {
                int mode = (int)floor(_Mode + 0.5);
                if (mode == 1) return LinearToneMapping(color);
                if (mode == 2) return ReinhardToneMapping(color);
                if (mode == 3) return CineonToneMapping(color);
                if (mode == 4) return ACESFilmicToneMapping(color);
                if (mode == 6) return AgXToneMapping(color);
                if (mode == 7) return NeutralToneMapping(color);
                return color;
            }

            float4 frag(v2f_img input) : SV_Target
            {
                float4 source = tex2D(_MainTex, input.uv);
                float alpha = source.a;
                // The transparent camera is composited into an alpha-preserving
                // buffer. Recover straight RGB before the non-linear operator,
                // then restore premultiplication for the browser framebuffer.
                float3 straightColor = alpha > 1e-6 ? source.rgb / alpha : 0.0;
                float3 mapped = ApplyToneMapping(straightColor);
                return float4(mapped * alpha, alpha);
            }
            ENDCG
        }
    }

    Fallback Off
}
