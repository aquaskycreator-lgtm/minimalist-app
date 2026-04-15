#!/bin/bash
export PATH="/Users/nakagawachiharu/.nvm/versions/node/v24.14.1/bin:$PATH"
cd /Users/nakagawachiharu/Claude/minimalist-app
exec node node_modules/.bin/next dev --port 3000
