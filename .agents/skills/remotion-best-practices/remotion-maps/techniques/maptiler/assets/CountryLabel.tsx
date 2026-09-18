import type React from "react";
import { Easing, interpolate } from "remotion";

// Reusable country label. Supply typography and final values from the consuming project; the CSS custom
// properties below provide neutral fallbacks. Positioned by its centre (x,y in screen px).
export const CountryLabel: React.FC<{
  name: string;
  color: string;
  reveal: number;
  x: number;
  y: number;
}> = ({ name, color, reveal, x, y }) => {
  const e = interpolate(reveal, [0, 1], [0, 1], {
    easing: Easing.bezier(
      0.333_333_333_333_333_3,
      1,
      0.666_666_666_666_666_6,
      1
    ),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        left: x,
        opacity: e,
        pointerEvents: "none",
        position: "absolute",
        top: y,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          transform: `translateY(${(1 - e) * 16}px)`,
        }}
      >
        {/* accent rule — draws out from the centre in the country's colour */}
        <div
          style={{
            background: color,
            borderRadius: 2,
            boxShadow: `0 0 10px ${color}`,
            height: 3,
            transform: `scaleX(${e})`,
            width: 64,
          }}
        />
        <div
          style={{
            color: "var(--map-label-color, #ffffff)",
            fontFamily: "var(--map-label-font, system-ui, sans-serif)",
            fontSize: "var(--map-label-size, 34px)",
            fontWeight: "var(--map-label-weight, 600)",
            letterSpacing: "var(--map-label-tracking, 0.16em)",
            marginTop: 13,
            paddingLeft: "var(--map-label-tracking, 0.16em)",
            textShadow: "var(--map-label-shadow, 0 2px 18px rgba(0,0,0,0.9))",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
      </div>
    </div>
  );
};
