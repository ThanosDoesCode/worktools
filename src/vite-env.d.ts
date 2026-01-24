/// <reference types="vite/client" />
declare module "@neslinesli93/qpdf-wasm/dist/qpdf.js" {
  const createModule: (opts: { locateFile: (file: string) => string }) => Promise<any>;
  export default createModule;
}

declare module "@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url" {
  const url: string;
  export default url;
}
