#!/bin/bash
set -e

rm -rf dist
mkdir -p dist/mr-lab

cp -r projects/01.MIRROR   dist/mr-lab/mirror
cp -r projects/02.MR_TEST  dist/mr-lab/mr-test
cp -r projects/03.TINYMYSELF dist/mr-lab/tinymyself
cp -r projects/04.MROCEANs  dist/mr-lab/mroceans
cp -r projects/05.Malrang   dist/mr-lab/malrang
cp -r projects/07.MalrangCat dist/mr-lab/malrangcat

echo "Build complete:"
find dist/mr-lab -name "index.html" | sort
