#!/bin/sh -e

tmpdir=$(mktemp -d)

npm install
npm run build

mv build $tmpdir
mv node_modules $tmpdir
git checkout gh_pages
rm -rfv static *.txt *.json *.png *.html *.ico *.json *.js *.css
mv $tmpdir/build/* ./
git add .
git add -f static
git commit --amend -m "Deploy"
mv $tmpdir/node_modules ./
echo 'invoke "git push origin +gh_pages" to deploy'
rmdir $tmpdir/build
rmdir $tmpdir
