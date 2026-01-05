import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConsoleLogger } from "@/core/ConsoleLogger";

describe("ConsoleLogger", () => {
  let logger: ConsoleLogger;
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    logger = new ConsoleLogger();

    // Spy on console methods
    consoleSpy = {
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
      info: vi.spyOn(console, "info").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("trace logging", () => {
    it("should log trace message without metadata", () => {
      logger.trace("Test trace message");

      expect(consoleSpy.debug).toHaveBeenCalledWith(
        "[trace] Test trace message"
      );
      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
    });

    it("should log trace message with metadata", () => {
      const meta = { userId: 123, action: "login" };
      logger.trace("User action", meta);

      expect(consoleSpy.debug).toHaveBeenCalledWith(
        "[trace] User action",
        meta
      );
      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
    });
  });

  describe("debug logging", () => {
    it("should log debug message without metadata", () => {
      logger.debug("Debug information");

      expect(consoleSpy.debug).toHaveBeenCalledWith(
        "[debug] Debug information"
      );
      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
    });

    it("should log debug message with metadata", () => {
      const meta = { component: "InputSystem", state: "active" };
      logger.debug("Component state", meta);

      expect(consoleSpy.debug).toHaveBeenCalledWith(
        "[debug] Component state",
        meta
      );
      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
    });
  });

  describe("info logging", () => {
    it("should log info message without metadata", () => {
      logger.info("System initialized");

      expect(consoleSpy.info).toHaveBeenCalledWith("[info] System initialized");
      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
    });

    it("should log info message with metadata", () => {
      const meta = { version: "1.0.0", environment: "development" };
      logger.info("Application started", meta);

      expect(consoleSpy.info).toHaveBeenCalledWith(
        "[info] Application started",
        meta
      );
      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
    });
  });

  describe("warn logging", () => {
    it("should log warning message without metadata", () => {
      logger.warn("Deprecated API usage");

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        "[warn] Deprecated API usage"
      );
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    });

    it("should log warning message with metadata", () => {
      const meta = { api: "oldFunction", replacement: "newFunction" };
      logger.warn("API deprecation warning", meta);

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        "[warn] API deprecation warning",
        meta
      );
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe("error logging", () => {
    it("should log error message without metadata", () => {
      logger.error("System failure");

      expect(consoleSpy.error).toHaveBeenCalledWith("[error] System failure");
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    it("should log error message with metadata", () => {
      const meta = { errorCode: 500, stack: "Error: Test\n  at..." };
      logger.error("Server error occurred", meta);

      expect(consoleSpy.error).toHaveBeenCalledWith(
        "[error] Server error occurred",
        meta
      );
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });
  });

  describe("metadata handling", () => {
    it("should handle complex metadata objects", () => {
      const complexMeta = {
        nested: {
          deep: {
            value: 42,
          },
        },
        array: [1, 2, 3],
        boolean: true,
        null: null,
        undefined: undefined,
      };

      logger.info("Complex metadata test", complexMeta);

      expect(consoleSpy.info).toHaveBeenCalledWith(
        "[info] Complex metadata test",
        complexMeta
      );
    });

    it("should handle empty metadata object", () => {
      logger.info("Empty meta test", {});

      expect(consoleSpy.info).toHaveBeenCalledWith(
        "[info] Empty meta test",
        {}
      );
    });

    it("should handle undefined metadata explicitly", () => {
      logger.info("Undefined meta test", undefined);

      // When undefined is passed, the logger treats it as no metadata
      expect(consoleSpy.info).toHaveBeenCalledWith(
        "[info] Undefined meta test"
      );
    });
  });

  describe("message formatting", () => {
    it("should handle empty messages", () => {
      logger.info("");

      expect(consoleSpy.info).toHaveBeenCalledWith("[info] ");
    });

    it("should handle special characters in messages", () => {
      const specialMessage = "Message with 🚀 emoji and \n newlines \t tabs";
      logger.info(specialMessage);

      expect(consoleSpy.info).toHaveBeenCalledWith(`[info] ${specialMessage}`);
    });

    it("should handle very long messages", () => {
      const longMessage = "A".repeat(1000);
      logger.info(longMessage);

      expect(consoleSpy.info).toHaveBeenCalledWith(`[info] ${longMessage}`);
    });
  });

  describe("different log levels", () => {
    it("should use correct console methods for each level", () => {
      logger.trace("trace");
      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");

      expect(consoleSpy.debug).toHaveBeenCalledTimes(2); // trace and debug both use console.debug
      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    it("should have consistent prefix formatting across all levels", () => {
      logger.trace("message");
      logger.debug("message");
      logger.info("message");
      logger.warn("message");
      logger.error("message");

      expect(consoleSpy.debug).toHaveBeenCalledWith("[trace] message");
      expect(consoleSpy.debug).toHaveBeenCalledWith("[debug] message");
      expect(consoleSpy.info).toHaveBeenCalledWith("[info] message");
      expect(consoleSpy.warn).toHaveBeenCalledWith("[warn] message");
      expect(consoleSpy.error).toHaveBeenCalledWith("[error] message");
    });
  });

  describe("performance considerations", () => {
    it("should not modify original metadata object", () => {
      const originalMeta = { count: 1, data: [1, 2, 3] };
      const metaCopy = JSON.parse(JSON.stringify(originalMeta));

      logger.info("Test", originalMeta);

      expect(originalMeta).toEqual(metaCopy);
    });

    it("should handle rapid logging calls", () => {
      for (let i = 0; i < 100; i++) {
        logger.info(`Message ${i}`, { index: i });
      }

      expect(consoleSpy.info).toHaveBeenCalledTimes(100);
    });
  });
});
