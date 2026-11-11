import { checklistKey, useChecklist } from "../src/state/checklist";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

describe("checklist progress (mirrors web semantics)", () => {
  beforeEach(() => useChecklist.setState({ progress: {} }));

  it("uses the checklist:<slug> key and stores ticked item texts", () => {
    expect(checklistKey("passport")).toBe("checklist:passport");
    useChecklist.getState().toggle("passport", "Photo");
    expect(useChecklist.getState().progress["checklist:passport"]).toEqual(["Photo"]);
  });

  it("toggles off on a second tap and never mutates previous arrays", () => {
    const first = useChecklist.getState().toggle("passport", "Photo");
    const second = useChecklist.getState().toggle("passport", "Photo");
    expect(first).toEqual(["Photo"]);
    expect(second).toEqual([]);
  });

  it("counts only ticks still present in the current item list", () => {
    const { toggle, doneCount } = useChecklist.getState();
    toggle("visa", "Old item");
    toggle("visa", "Passport copy");
    expect(doneCount("visa", ["Passport copy", "Photo"])).toBe(1);
  });
});
