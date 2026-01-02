import { describe, it, expect, beforeEach, vi } from "vitest";
import { SceneManager } from "@/core/SceneManager";
import { Scene } from "@/core/Scene";
import type { ILogger } from "@/core/ILogger";

// Mock logger for testing
class MockLogger implements ILogger {
  trace = vi.fn();
  debug = vi.fn();
  info = vi.fn();
  warn = vi.fn();
  error = vi.fn();
}

describe("SceneManager", () => {
  let sceneManager: SceneManager;
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockLogger = new MockLogger();
    sceneManager = new SceneManager(mockLogger);
  });

  describe("initialization", () => {
    it("should create a default scene on initialization", () => {
      const activeScene = sceneManager.getActiveScene();
      expect(activeScene).toBeInstanceOf(Scene);
      expect(activeScene.name).toBe("Default");
    });

    it("should initialize without a logger", () => {
      const managerWithoutLogger = new SceneManager();
      const activeScene = managerWithoutLogger.getActiveScene();
      expect(activeScene.name).toBe("Default");
    });

    it("should have one scene in the list after initialization", () => {
      const scenes = sceneManager.listScenes();
      expect(scenes).toHaveLength(1);
      expect(scenes[0].name).toBe("Default");
    });

    it("should set active scene index to 0", () => {
      const activeScene = sceneManager.getActiveScene();
      const scenes = sceneManager.listScenes();
      expect(activeScene).toBe(scenes[0]);
    });
  });

  describe("scene creation", () => {
    it("should create a new scene with given name", () => {
      const scene = sceneManager.createScene("TestScene");

      expect(scene).toBeInstanceOf(Scene);
      expect(scene.name).toBe("TestScene");
      expect(scene.entityList).toBeDefined();
    });

    it("should add new scene to scenes list", () => {
      sceneManager.createScene("TestScene");
      const scenes = sceneManager.listScenes();

      expect(scenes).toHaveLength(2);
      expect(scenes[1].name).toBe("TestScene");
    });

    it("should return existing scene if name already exists", () => {
      const scene1 = sceneManager.createScene("TestScene");
      const scene2 = sceneManager.createScene("TestScene");

      expect(scene1).toBe(scene2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Scene 'TestScene' already exists - returning existing scene"
      );
    });

    it("should log warning when creating duplicate scene", () => {
      sceneManager.createScene("TestScene");
      sceneManager.createScene("TestScene");

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Scene 'TestScene' already exists - returning existing scene"
      );
    });

    it("should create multiple unique scenes", () => {
      const scene1 = sceneManager.createScene("Scene1");
      const scene2 = sceneManager.createScene("Scene2");
      const scene3 = sceneManager.createScene("Scene3");

      expect(scene1.name).toBe("Scene1");
      expect(scene2.name).toBe("Scene2");
      expect(scene3.name).toBe("Scene3");
      expect(sceneManager.listScenes()).toHaveLength(4); // Including default scene
    });
  });

  describe("active scene management", () => {
    beforeEach(() => {
      sceneManager.createScene("Scene1");
      sceneManager.createScene("Scene2");
      sceneManager.createScene("Scene3");
    });

    it("should change active scene by name", () => {
      sceneManager.changeActiveScene("Scene2");
      const activeScene = sceneManager.getActiveScene();

      expect(activeScene.name).toBe("Scene2");
    });

    it("should log error and not change scene if name doesn't exist", () => {
      const originalActive = sceneManager.getActiveScene();
      sceneManager.changeActiveScene("NonExistentScene");

      expect(sceneManager.getActiveScene()).toBe(originalActive);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Scene with name 'NonExistentScene' does not exist"
      );
    });

    it("should maintain active scene when switching to same scene", () => {
      sceneManager.changeActiveScene("Scene1");
      const firstActive = sceneManager.getActiveScene();
      sceneManager.changeActiveScene("Scene1");

      expect(sceneManager.getActiveScene()).toBe(firstActive);
    });

    it("should switch between multiple scenes correctly", () => {
      sceneManager.changeActiveScene("Scene1");
      expect(sceneManager.getActiveScene().name).toBe("Scene1");

      sceneManager.changeActiveScene("Scene3");
      expect(sceneManager.getActiveScene().name).toBe("Scene3");

      sceneManager.changeActiveScene("Default");
      expect(sceneManager.getActiveScene().name).toBe("Default");
    });
  });

  describe("scene retrieval", () => {
    beforeEach(() => {
      sceneManager.createScene("TestScene");
    });

    it("should get scene by name", () => {
      const scene = sceneManager.getScene("TestScene");
      expect(scene.name).toBe("TestScene");
    });

    it("should return default scene if requested scene doesn't exist", () => {
      const scene = sceneManager.getScene("NonExistentScene");
      expect(scene.name).toBe("Default");
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Scene with name 'NonExistentScene' does not exist"
      );
    });

    it("should get default scene by name", () => {
      const scene = sceneManager.getScene("Default");
      expect(scene.name).toBe("Default");
    });
  });

  describe("scene destruction", () => {
    beforeEach(() => {
      sceneManager.createScene("Scene1");
      sceneManager.createScene("Scene2");
      sceneManager.createScene("Scene3");
    });

    it("should destroy scene by name", () => {
      sceneManager.destroyScene("Scene2");
      const scenes = sceneManager.listScenes();

      expect(scenes).toHaveLength(3); // Default, Scene1, Scene3
      expect(scenes.find((s) => s.name === "Scene2")).toBeUndefined();
    });

    it("should log error when trying to destroy non-existent scene", () => {
      sceneManager.destroyScene("NonExistentScene");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Scene with name 'NonExistentScene' does not exist"
      );
    });

    it("should adjust active scene index when destroying scene before active", () => {
      sceneManager.changeActiveScene("Scene3"); // Index 3
      sceneManager.destroyScene("Scene1"); // Index 1

      expect(sceneManager.getActiveScene().name).toBe("Scene3");
      const scenes = sceneManager.listScenes();
      expect(scenes).toHaveLength(3); // Default, Scene2, Scene3
    });

    it("should fallback active scene when destroying active scene", () => {
      sceneManager.changeActiveScene("Scene2"); // Index 2
      sceneManager.destroyScene("Scene2");

      const activeScene = sceneManager.getActiveScene();
      expect(activeScene.name).not.toBe("Scene2");
      expect(["Default", "Scene1", "Scene3"]).toContain(activeScene.name);
    });

    it("should fallback to nearest valid index when destroying active scene", () => {
      sceneManager.changeActiveScene("Scene3"); // Index 3 (last scene)
      sceneManager.destroyScene("Scene3");

      // Should fallback to Scene2 (index 2, which becomes the new last index)
      const activeScene = sceneManager.getActiveScene();
      expect(activeScene.name).toBe("Scene2");
    });

    it("should create default scene if all scenes are destroyed", () => {
      // Destroy all scenes except default
      sceneManager.destroyScene("Scene1");
      sceneManager.destroyScene("Scene2");
      sceneManager.destroyScene("Scene3");
      sceneManager.destroyScene("Default");

      const scenes = sceneManager.listScenes();
      expect(scenes).toHaveLength(1);
      expect(scenes[0].name).toBe("Default");
      expect(sceneManager.getActiveScene().name).toBe("Default");
    });

    it("should handle destroying active scene when it's the first scene", () => {
      sceneManager.changeActiveScene("Default"); // Index 0
      sceneManager.destroyScene("Default");

      // Should fallback to Scene1 (which becomes index 0)
      const activeScene = sceneManager.getActiveScene();
      expect(activeScene.name).toBe("Scene1");
    });

    it("should handle destroying active scene in middle of list", () => {
      sceneManager.changeActiveScene("Scene2"); // Index 2
      sceneManager.destroyScene("Scene2");

      // Should fallback to index 2, which is now Scene3
      const activeScene = sceneManager.getActiveScene();
      expect(activeScene.name).toBe("Scene3");
    });
  });

  describe("scene listing", () => {
    it("should return readonly array of scenes", () => {
      const scenes = sceneManager.listScenes();
      expect(scenes).toHaveLength(1);
      expect(scenes[0].name).toBe("Default");
    });

    it("should return updated list after adding scenes", () => {
      sceneManager.createScene("Scene1");
      sceneManager.createScene("Scene2");

      const scenes = sceneManager.listScenes();
      expect(scenes).toHaveLength(3);
      expect(scenes.map((s) => s.name)).toEqual([
        "Default",
        "Scene1",
        "Scene2",
      ]);
    });

    it("should return updated list after removing scenes", () => {
      sceneManager.createScene("Scene1");
      sceneManager.createScene("Scene2");
      sceneManager.destroyScene("Scene1");

      const scenes = sceneManager.listScenes();
      expect(scenes).toHaveLength(2);
      expect(scenes.map((s) => s.name)).toEqual(["Default", "Scene2"]);
    });

    it("should maintain scene order", () => {
      sceneManager.createScene("A");
      sceneManager.createScene("B");
      sceneManager.createScene("C");

      const scenes = sceneManager.listScenes();
      expect(scenes.map((s) => s.name)).toEqual(["Default", "A", "B", "C"]);
    });
  });

  describe("edge cases", () => {
    it("should handle empty scene name", () => {
      const scene = sceneManager.createScene("");
      expect(scene.name).toBe("");
      expect(sceneManager.listScenes()).toHaveLength(2);
    });

    it("should handle scene names with special characters", () => {
      const specialNames = [
        "Scene-1",
        "Scene_2",
        "Scene 3",
        "Scene@4",
        "Scene#5",
      ];

      specialNames.forEach((name) => {
        const scene = sceneManager.createScene(name);
        expect(scene.name).toBe(name);
      });

      expect(sceneManager.listScenes()).toHaveLength(6); // 5 + Default
    });

    it("should handle very long scene names", () => {
      const longName = "A".repeat(1000);
      const scene = sceneManager.createScene(longName);
      expect(scene.name).toBe(longName);
    });

    it("should handle rapid scene creation and destruction", () => {
      // Create many scenes
      for (let i = 0; i < 100; i++) {
        sceneManager.createScene(`Scene${i}`);
      }
      expect(sceneManager.listScenes()).toHaveLength(101);

      // Destroy every other scene
      for (let i = 0; i < 100; i += 2) {
        sceneManager.destroyScene(`Scene${i}`);
      }
      expect(sceneManager.listScenes()).toHaveLength(51); // 50 remaining + Default
    });

    it("should maintain scene integrity after multiple operations", () => {
      // Complex sequence of operations
      sceneManager.createScene("A");
      sceneManager.createScene("B");
      sceneManager.changeActiveScene("A");
      sceneManager.createScene("C");
      sceneManager.destroyScene("B");
      sceneManager.changeActiveScene("C");
      sceneManager.createScene("D");
      sceneManager.destroyScene("A");

      const scenes = sceneManager.listScenes();
      expect(scenes.map((s) => s.name)).toEqual(["Default", "C", "D"]);
      expect(sceneManager.getActiveScene().name).toBe("C");
    });
  });

  describe("logging behavior", () => {
    it("should not throw errors when logger is not provided", () => {
      const managerWithoutLogger = new SceneManager();

      expect(() => {
        managerWithoutLogger.changeActiveScene("NonExistent");
        managerWithoutLogger.createScene("Test");
        managerWithoutLogger.createScene("Test"); // Duplicate
        managerWithoutLogger.destroyScene("NonExistent");
        managerWithoutLogger.getScene("NonExistent");
      }).not.toThrow();
    });

    it("should call logger methods appropriately", () => {
      sceneManager.createScene("Test");
      sceneManager.createScene("Test"); // Should warn
      sceneManager.changeActiveScene("NonExistent"); // Should error
      sceneManager.destroyScene("NonExistent"); // Should error
      sceneManager.getScene("NonExistent"); // Should error

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledTimes(3);
    });
  });

  describe("scene object integrity", () => {
    it("should ensure each scene has its own entity list", () => {
      const scene1 = sceneManager.createScene("Scene1");
      const scene2 = sceneManager.createScene("Scene2");

      expect(scene1.entityList).not.toBe(scene2.entityList);
      expect(scene1.entityList).toBeDefined();
      expect(scene2.entityList).toBeDefined();
    });

    it("should maintain scene references after operations", () => {
      const scene = sceneManager.createScene("TestScene");
      const originalEntityList = scene.entityList;

      sceneManager.changeActiveScene("TestScene");
      sceneManager.changeActiveScene("Default");

      expect(scene.entityList).toBe(originalEntityList);
      expect(scene.name).toBe("TestScene");
    });

    it("should return same scene instance on multiple gets", () => {
      sceneManager.createScene("TestScene");
      const scene1 = sceneManager.getScene("TestScene");
      const scene2 = sceneManager.getScene("TestScene");

      expect(scene1).toBe(scene2);
    });
  });
});
