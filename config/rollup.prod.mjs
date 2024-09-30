import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import cleanup from 'rollup-plugin-cleanup';
// import { uglify } from "rollup-plugin-uglify";
import terser from '@rollup/plugin-terser'

export default {
    input: 'src/main.js',
    output: [
        {
            name: "CesiumFast",
            file: "dist/esm/CesiumFast.js",
            format: 'es',
            sourcemap: true,
        },
        {
            name: "CesiumFast",
            file: "dist/umd/CesiumFast.js",
            format: 'umd',
            sourcemap: true,
        }
    ],
    plugins: [
        resolve({
            browser: true,
        }),
        json(),
        commonjs(),
        babel({
            exclude: 'node_modules/**',
        }),
        // uglify(),
        terser(),
        cleanup()
    ],
    external: []
};