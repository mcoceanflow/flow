/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string | object = string> {
      hrefInputParams: { pathname: Router.RelativePathString, params?: Router.UnknownInputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownInputParams } | { pathname: `/add-task`; params?: Router.UnknownInputParams; } | { pathname: `/calendar`; params?: Router.UnknownInputParams; } | { pathname: `/`; params?: Router.UnknownInputParams; } | { pathname: `/index_old`; params?: Router.UnknownInputParams; } | { pathname: `/TestFirebaseScreen`; params?: Router.UnknownInputParams; } | { pathname: `/_sitemap`; params?: Router.UnknownInputParams; };
      hrefOutputParams: { pathname: Router.RelativePathString, params?: Router.UnknownOutputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownOutputParams } | { pathname: `/add-task`; params?: Router.UnknownOutputParams; } | { pathname: `/calendar`; params?: Router.UnknownOutputParams; } | { pathname: `/`; params?: Router.UnknownOutputParams; } | { pathname: `/index_old`; params?: Router.UnknownOutputParams; } | { pathname: `/TestFirebaseScreen`; params?: Router.UnknownOutputParams; } | { pathname: `/_sitemap`; params?: Router.UnknownOutputParams; };
      href: Router.RelativePathString | Router.ExternalPathString | `/add-task${`?${string}` | `#${string}` | ''}` | `/calendar${`?${string}` | `#${string}` | ''}` | `/${`?${string}` | `#${string}` | ''}` | `/index_old${`?${string}` | `#${string}` | ''}` | `/TestFirebaseScreen${`?${string}` | `#${string}` | ''}` | `/_sitemap${`?${string}` | `#${string}` | ''}` | { pathname: Router.RelativePathString, params?: Router.UnknownInputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownInputParams } | { pathname: `/add-task`; params?: Router.UnknownInputParams; } | { pathname: `/calendar`; params?: Router.UnknownInputParams; } | { pathname: `/`; params?: Router.UnknownInputParams; } | { pathname: `/index_old`; params?: Router.UnknownInputParams; } | { pathname: `/TestFirebaseScreen`; params?: Router.UnknownInputParams; } | { pathname: `/_sitemap`; params?: Router.UnknownInputParams; };
    }
  }
}
