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
cp -r projects/09.MyTinySlime dist/mr-lab/slimei

# Slimei는 정적 사이트 + Cloudflare Pages Function(/api/intent) 사용.
# Pages Functions는 빌드 출력 루트(dist/mr-lab)의 functions/ 에서만 인식되므로
# 프로젝트의 functions/ 를 출력 루트로 끌어올린다. (키는 Pages 환경변수에서만)
mkdir -p dist/mr-lab/functions
cp -r projects/09.MyTinySlime/functions/. dist/mr-lab/functions/
rm -rf dist/mr-lab/slimei/functions

echo "Build complete:"
find dist/mr-lab -name "index.html" | sort
echo "Functions:"
find dist/mr-lab/functions -type f | sort
