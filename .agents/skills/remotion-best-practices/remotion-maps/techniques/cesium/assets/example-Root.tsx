import type React from "react";
import { Composition } from "remotion";
import {
  CesiumFlythrough,
  type CesiumFlythroughProps,
} from "./CesiumFlythrough.tsx";
import cityPath from "./city-path.json" with { type: "json" };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      component={CesiumFlythrough}
      defaultProps={{ mode: "landscape" } satisfies CesiumFlythroughProps}
      durationInFrames={24 * 30}
      fps={30}
      height={1080}
      id="LandscapeFlyover"
      width={1920}
    />
    <Composition
      component={CesiumFlythrough}
      defaultProps={
        {
          altitudeEnd: 500,
          altitudeStart: 700,
          lookAheadKm: 0.7,
          maximumScreenSpaceError: 6,
          mode: "city",
          path: cityPath as [number, number][],
          pitchFromNadir: 72,
          travelKm: 4.5,
          verticalExaggeration: 1,
        } satisfies CesiumFlythroughProps
      }
      durationInFrames={18 * 30}
      fps={30}
      height={1080}
      id="CityFlyover"
      width={1920}
    />
  </>
);
