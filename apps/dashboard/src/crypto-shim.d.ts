type HashEncoding = "hex";
export declare function createHash(algorithm: string): {
    update(value: string): /*elided*/ any;
    digest(encoding: HashEncoding): string;
};
export {};
