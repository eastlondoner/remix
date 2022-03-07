# Welcome to Remix Google Cloud Functions Adapter!

[Remix](https://remix.run) is a web framework that helps you build better websites with React.

This is a Remix Adapter for Google Cloud Functions

## To Rebase

`git rebase remix@1.19.3`

## To Publish

Before publishing check the git sha of the release from github of the main remix project and run `git diff <sha of main release>`

Edit the `packages/remix-google-cloud-functions/package.json` to have the correct remix dependency version and the desired publication version

1. run `yarn install && yarn build` in the root of the monorepo.`
2. `cd build/node_modules/@remix-run/google-cloud-functions/`
3. `npm publish`


For more information about Remix, [visit remix.run](https://remix.run)!
