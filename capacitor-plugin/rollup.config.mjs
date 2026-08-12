import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/esm/index.js',
      format: 'esm',
    },
  ],
  external: ['@capacitor/core'],
  plugins: [typescript()],
};
