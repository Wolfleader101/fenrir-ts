import { describe, it, expect } from "vitest";
import { NullLogger } from "@/core/NullLogger";

describe("NullLogger", () => {
  it("should implement ILogger interface", () => {
    const logger = new NullLogger();

    expect(logger).toBeDefined();
    expect(typeof logger.trace).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("should handle trace calls without throwing", () => {
    const logger = new NullLogger();

    expect(() => logger.trace("test message")).not.toThrow();
    expect(() => logger.trace("test message", { key: "value" })).not.toThrow();
  });

  it("should handle debug calls without throwing", () => {
    const logger = new NullLogger();

    expect(() => logger.debug("test message")).not.toThrow();
    expect(() => logger.debug("test message", { key: "value" })).not.toThrow();
  });

  it("should handle info calls without throwing", () => {
    const logger = new NullLogger();

    expect(() => logger.info("test message")).not.toThrow();
    expect(() => logger.info("test message", { key: "value" })).not.toThrow();
  });

  it("should handle warn calls without throwing", () => {
    const logger = new NullLogger();

    expect(() => logger.warn("test message")).not.toThrow();
    expect(() => logger.warn("test message", { key: "value" })).not.toThrow();
  });

  it("should handle error calls without throwing", () => {
    const logger = new NullLogger();

    expect(() => logger.error("test message")).not.toThrow();
    expect(() => logger.error("test message", { key: "value" })).not.toThrow();
  });

  it("should not return anything from log methods", () => {
    const logger = new NullLogger();

    expect(logger.trace("test")).toBeUndefined();
    expect(logger.debug("test")).toBeUndefined();
    expect(logger.info("test")).toBeUndefined();
    expect(logger.warn("test")).toBeUndefined();
    expect(logger.error("test")).toBeUndefined();
  });
});
