// The part of opencc-js the pipeline uses (the package ships no types).
declare module "opencc-js" {
  export function Converter(options: { from: string; to: string }): (text: string) => string;
}
