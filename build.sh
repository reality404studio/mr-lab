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
# Slimei의 /api/intent 함수는 레포 루트 /functions 에서 Cloudflare가 컴파일한다
# (빌드 출력이 아니라 루트). 정적 복사본은 노출 방지 위해 제거.
rm -rf dist/mr-lab/slimei/functions

echo "Build complete:"
find dist/mr-lab -name "index.html" | sort
