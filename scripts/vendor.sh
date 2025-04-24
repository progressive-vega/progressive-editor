#!/usr/bin/env bash

set -e

DATA=public/data
SPEC=public/spec

echo "Copying data to '$DATA'."
rm -rf "$DATA"
cp -R node_modules/vega-datasets/data/ "$DATA"

echo "Copy examples to '$SPEC'."

# senza la "v"
VEGA_VERSION=$(scripts/version.sh vega)
VEGA_LITE_VERSION=$(scripts/version.sh vega-lite)

pushd /tmp

# scarica i tarball di Vega e Vega-Lite
curl -L -o vega.tar.gz "https://github.com/vega/vega/archive/refs/tags/v$VEGA_VERSION.tar.gz"
curl -L -o vl.tar.gz   "https://github.com/vega/vega-lite/archive/refs/tags/v$VEGA_LITE_VERSION.tar.gz"

# Estrai solo la docs/examples di Vega
tar xzf vega.tar.gz --strip-components=1 -C . "vega-$VEGA_VERSION/docs"

# Estrai solo le examples di Vega-Lite, escludendo i symlink problematici
tar xzf vl.tar.gz \
    --exclude="vega-lite-$VEGA_LITE_VERSION/examples/compiled/data" \
    --exclude="vega-lite-$VEGA_LITE_VERSION/examples/specs/data" \
    --strip-components=1 -C . "vega-lite-$VEGA_LITE_VERSION/examples" "vega-lite-$VEGA_LITE_VERSION/site/_data"

popd

# Pulisco e ricreo la cartella di destinazione
rm -rf "$SPEC"
mkdir -p "$SPEC/vega" "$SPEC/vega-lite"

# Copio i file .vg.json di Vega
cp "/tmp/vega-$VEGA_VERSION/docs/examples/"*.vg.json "$SPEC/vega"

# Copio i file .vl.json di Vega-Lite (specs)
cp "/tmp/vega-lite-$VEGA_LITE_VERSION/examples/specs/"*.vl.json "$SPEC/vega-lite/"

# Copio gli indici JSON
cp "/tmp/vega-lite-$VEGA_LITE_VERSION/site/_data/examples.json" "$SPEC/vega-lite/index.json"
cp "/tmp/vega-$VEGA_VERSION/docs/_data/examples.json"      "$SPEC/vega/index.json"
