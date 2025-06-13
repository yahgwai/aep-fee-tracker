describe("TypeScript and Jest Setup", () => {
  it("should run tests with TypeScript", () => {
    const sum = (a: number, b: number): number => a + b;
    expect(sum(2, 3)).toBe(5);
  });

  it("should enforce strict type checking", () => {
    const testStrictTypes = (): void => {
      const value: string = "hello";
      expect(typeof value).toBe("string");
    };

    expect(testStrictTypes).not.toThrow();
  });

  it("should have access to Node.js types", () => {
    const nodeVersion: string = process.version;
    expect(nodeVersion).toMatch(/^v\d+\.\d+\.\d+$/);
  });
});
