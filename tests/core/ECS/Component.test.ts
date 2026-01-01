import { describe, it, expect } from "vitest";
import { defineComponent, type ComponentType } from "@/core/ECS";

describe("Component System", () => {
  describe("defineComponent", () => {
    it("should create a component type with a unique symbol", () => {
      type Position = { x: number; y: number };
      const Position = defineComponent<Position>("Position");

      expect(typeof Position).toBe("symbol");
      expect(Position.toString()).toContain("Position");
    });

    it("should create different symbols for different component names", () => {
      type Position = { x: number; y: number };
      type Velocity = { x: number; y: number };

      const Position = defineComponent<Position>("Position");
      const Velocity = defineComponent<Velocity>("Velocity");

      expect(Position).not.toBe(Velocity);
    });

    it("should return the same symbol for the same component name", () => {
      // This tests the Symbol.for behavior - same name should return same symbol
      const Position1 = defineComponent<{ x: number; y: number }>("Position");
      const Position2 = defineComponent<{ x: number; y: number }>("Position");

      expect(Position1).toBe(Position2);
    });

    it("should work with different component data types", () => {
      type Position = { x: number; y: number };
      type Health = { hp: number; maxHp: number };
      type Name = { value: string };
      type Tags = string[];
      type Config = { [key: string]: any };

      const Position = defineComponent<Position>("Position");
      const Health = defineComponent<Health>("Health");
      const Name = defineComponent<Name>("Name");
      const Tags = defineComponent<Tags>("Tags");
      const Config = defineComponent<Config>("Config");

      expect(typeof Position).toBe("symbol");
      expect(typeof Health).toBe("symbol");
      expect(typeof Name).toBe("symbol");
      expect(typeof Tags).toBe("symbol");
      expect(typeof Config).toBe("symbol");

      // All should be unique
      const components = [Position, Health, Name, Tags, Config];
      const uniqueComponents = new Set(components);
      expect(uniqueComponents.size).toBe(components.length);
    });

    it("should handle empty and special characters in component names", () => {
      const Empty = defineComponent<{}>(""); // Empty name
      const Special = defineComponent<{}>("Component-With_Special.Chars123");
      const Unicode = defineComponent<{}>("Component🚀");

      expect(typeof Empty).toBe("symbol");
      expect(typeof Special).toBe("symbol");
      expect(typeof Unicode).toBe("symbol");

      expect(Empty).not.toBe(Special);
      expect(Special).not.toBe(Unicode);
    });

    it("should maintain type safety at compile time", () => {
      type Position = { x: number; y: number };
      type Health = { hp: number; maxHp: number };

      const Position = defineComponent<Position>("Position");
      const Health = defineComponent<Health>("Health");

      // This test primarily exists to ensure TypeScript compilation works correctly
      // The type parameter should be preserved in the ComponentType<T>

      const positionType: ComponentType<Position> = Position;
      const healthType: ComponentType<Health> = Health;

      expect(positionType).toBe(Position);
      expect(healthType).toBe(Health);
    });

    it("should work with complex nested types", () => {
      interface ComplexComponent {
        nested: {
          values: number[];
          metadata: {
            created: Date;
            tags: Set<string>;
          };
        };
        optional?: string;
        computed: () => number;
      }

      const Complex = defineComponent<ComplexComponent>("Complex");
      expect(typeof Complex).toBe("symbol");
      expect(Complex.toString()).toContain("Complex");
    });

    it("should work with primitive types", () => {
      const NumberComp = defineComponent<number>("NumberComponent");
      const StringComp = defineComponent<string>("StringComponent");
      const BooleanComp = defineComponent<boolean>("BooleanComponent");
      const ArrayComp = defineComponent<number[]>("ArrayComponent");

      expect(typeof NumberComp).toBe("symbol");
      expect(typeof StringComp).toBe("symbol");
      expect(typeof BooleanComp).toBe("symbol");
      expect(typeof ArrayComp).toBe("symbol");

      // All should be unique
      const primitives = [NumberComp, StringComp, BooleanComp, ArrayComp];
      const uniquePrimitives = new Set(primitives);
      expect(uniquePrimitives.size).toBe(primitives.length);
    });

    it("should create symbols that can be used as Map keys", () => {
      type Position = { x: number; y: number };
      type Velocity = { x: number; y: number };

      const Position = defineComponent<Position>("Position");
      const Velocity = defineComponent<Velocity>("Velocity");

      const componentMap = new Map<symbol, string>();
      componentMap.set(Position, "Position Component");
      componentMap.set(Velocity, "Velocity Component");

      expect(componentMap.get(Position)).toBe("Position Component");
      expect(componentMap.get(Velocity)).toBe("Velocity Component");
      expect(componentMap.size).toBe(2);
    });

    it("should work with inheritance patterns", () => {
      interface BaseComponent {
        id: string;
      }

      interface DerivedComponent extends BaseComponent {
        value: number;
      }

      const Base = defineComponent<BaseComponent>("Base");
      const Derived = defineComponent<DerivedComponent>("Derived");

      expect(typeof Base).toBe("symbol");
      expect(typeof Derived).toBe("symbol");
      expect(Base).not.toBe(Derived);
    });
  });

  describe("ComponentType type", () => {
    it("should work as a type guard for symbol operations", () => {
      type Position = { x: number; y: number };
      const Position = defineComponent<Position>("Position");

      // Test that it's both a symbol and has the component type marker
      const componentType: ComponentType<Position> = Position;

      expect(typeof componentType).toBe("symbol");

      // Can be used in symbol operations
      expect(componentType.toString()).toContain("Position");
      expect(String(componentType)).toContain("Position");
    });

    it("should maintain type information for inference", () => {
      type Health = { hp: number; maxHp: number };
      const Health = defineComponent<Health>("Health");

      // This function should infer the component type from the ComponentType<T>
      function getComponentTypeName<T>(
        componentType: ComponentType<T>
      ): string {
        return componentType.toString();
      }

      const typeName = getComponentTypeName(Health);
      expect(typeName).toContain("Health");
    });
  });

  describe("cross-module compatibility", () => {
    it("should work consistently across different imports", () => {
      // Simulate importing the same component from different modules
      const Position1 = defineComponent<{ x: number; y: number }>(
        "CrossModulePosition"
      );
      const Position2 = defineComponent<{ x: number; y: number }>(
        "CrossModulePosition"
      );

      // Should be the same due to Symbol.for
      expect(Position1).toBe(Position2);
    });

    it("should maintain uniqueness across sessions", () => {
      // Test that symbols are consistent within the same session
      const components = new Set<symbol>();

      for (let i = 0; i < 100; i++) {
        const comp = defineComponent<{ value: number }>(`TestComponent${i}`);
        components.add(comp);
      }

      expect(components.size).toBe(100); // All should be unique
    });
  });

  describe("edge cases", () => {
    it("should handle very long component names", () => {
      const longName = "Component" + "A".repeat(1000);
      const LongNameComponent = defineComponent<{}>(longName);

      expect(typeof LongNameComponent).toBe("symbol");
      expect(LongNameComponent.toString()).toContain("Component");
    });

    it("should handle component types with undefined/null", () => {
      const UndefinedComp = defineComponent<undefined>("UndefinedComponent");
      const NullComp = defineComponent<null>("NullComponent");
      const VoidComp = defineComponent<void>("VoidComponent");

      expect(typeof UndefinedComp).toBe("symbol");
      expect(typeof NullComp).toBe("symbol");
      expect(typeof VoidComp).toBe("symbol");

      expect(UndefinedComp).not.toBe(NullComp);
      expect(NullComp).not.toBe(VoidComp);
    });

    it("should handle union types", () => {
      type Status = "active" | "inactive" | "pending";
      type MixedUnion = string | number | boolean;

      const StatusComp = defineComponent<Status>("Status");
      const MixedComp = defineComponent<MixedUnion>("Mixed");

      expect(typeof StatusComp).toBe("symbol");
      expect(typeof MixedComp).toBe("symbol");
      expect(StatusComp).not.toBe(MixedComp);
    });

    it("should handle generic types", () => {
      type GenericComponent<T> = { data: T; metadata: string };

      const StringGeneric =
        defineComponent<GenericComponent<string>>("StringGeneric");
      const NumberGeneric =
        defineComponent<GenericComponent<number>>("NumberGeneric");

      expect(typeof StringGeneric).toBe("symbol");
      expect(typeof NumberGeneric).toBe("symbol");
      expect(StringGeneric).not.toBe(NumberGeneric);
    });
  });

  describe("runtime behavior", () => {
    it("should be serializable in JSON when converted to string", () => {
      type Position = { x: number; y: number };
      const Position = defineComponent<Position>("Position");

      const serializable = {
        componentType: Position.toString(),
        description: Position.description || String(Position),
      };

      const json = JSON.stringify(serializable);
      const parsed = JSON.parse(json);

      expect(parsed.componentType).toContain("Position");
    });

    it("should work with Map and Set collections", () => {
      type Position = { x: number; y: number };
      type Velocity = { x: number; y: number };

      const Position = defineComponent<Position>("Position");
      const Velocity = defineComponent<Velocity>("Velocity");

      const map = new Map<symbol, string>();
      const set = new Set<symbol>();

      map.set(Position, "position data");
      map.set(Velocity, "velocity data");

      set.add(Position);
      set.add(Velocity);

      expect(map.get(Position)).toBe("position data");
      expect(map.get(Velocity)).toBe("velocity data");
      expect(set.has(Position)).toBe(true);
      expect(set.has(Velocity)).toBe(true);
    });
  });
});
