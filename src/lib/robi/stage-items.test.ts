import { describe, expect, it } from "vitest";
import { collisionProgress, createRandomStageItem } from "./stage-items";

function sequenceRandom(...values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values[values.length - 1] ?? 0;
}

describe("stage item generation", () => {
  it("places a random star directly above ROBI", () => {
    const item = createRandomStageItem(
      "ABOVE",
      { x: 4, y: 2 },
      sequenceRandom(0),
    );

    expect(item).toEqual({
      kind: "STAR",
      placement: "ABOVE",
      position: { x: 4, y: 3 },
      distanceSteps: 0,
    });
  });

  it("places a random box five steps to ROBI's left", () => {
    const item = createRandomStageItem(
      "LEFT",
      { x: 4, y: 2 },
      sequenceRandom(0.5, 0),
    );

    expect(item).toEqual({
      kind: "BOX",
      placement: "LEFT",
      position: { x: -1, y: 2 },
      distanceSteps: 5,
    });
  });

  it("places a random ball seven steps to ROBI's right", () => {
    const item = createRandomStageItem(
      "RIGHT",
      { x: 4, y: 2 },
      sequenceRandom(0.999, 0.999),
    );

    expect(item).toEqual({
      kind: "BALL",
      placement: "RIGHT",
      position: { x: 11, y: 2 },
      distanceSteps: 7,
    });
  });
});

describe("stage item collisions", () => {
  it("detects an object crossed before the end of a lateral walk", () => {
    const progress = collisionProgress(
      {
        kind: "BOX",
        placement: "RIGHT",
        position: { x: 5, y: 0 },
        distanceSteps: 5,
      },
      { x: 0, y: 0 },
      { x: 7, y: 0 },
      { type: "WALK_RIGHT", steps: 7 },
    );

    expect(progress).toBeCloseTo(5 / 7);
  });

  it("does not collide when ROBI walks away from the object", () => {
    expect(
      collisionProgress(
        {
          kind: "BALL",
          placement: "RIGHT",
          position: { x: 5, y: 0 },
          distanceSteps: 5,
        },
        { x: 0, y: 0 },
        { x: -3, y: 0 },
        { type: "WALK_LEFT", steps: 3 },
      ),
    ).toBeNull();
  });

  it("collides with an object above ROBI at the jump apex", () => {
    expect(
      collisionProgress(
        {
          kind: "STAR",
          placement: "ABOVE",
          position: { x: 2, y: 4 },
          distanceSteps: 0,
        },
        { x: 2, y: 3 },
        { x: 2, y: 3 },
        { type: "JUMP" },
      ),
    ).toBe(0.5);
  });
});
