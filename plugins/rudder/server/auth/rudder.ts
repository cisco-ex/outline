import passport from "@outlinewiki/koa-passport";
import type { Context } from "koa";
import Router from "koa-router";
import { Strategy } from "passport-custom";
import { parseEmail } from "@shared/utils/email";
import accountProvisioner from "@server/commands/accountProvisioner";
import { createContext } from "@server/context";
import { AuthenticationError } from "@server/errors";
import passportMiddleware from "@server/middlewares/passport";
import type { AuthenticationResult } from "@server/types";
import { toError } from "@shared/utils/error";
import {
  getKoaContext,
  getTeamFromContext,
  getClientFromOAuthState,
} from "@server/utils/passport";
import type User from "~/models/User";
import config from "../../plugin.json";

const router = new Router();

passport.use(
  config.id,
  // @ts-expect-error - use koa context instead
  new Strategy(async function (
    ctx: Context,
    done: (
      err: Error | null,
      user: User | null,
      result?: AuthenticationResult
    ) => void
  ) {
    const context = getKoaContext(ctx);
    try {
      const sub = ctx.headers["x-subject"] as string;
      const email = `${sub}@cisco.com`;

      if (!sub) {
        throw AuthenticationError("x-subject header is required");
      }

      const team = await getTeamFromContext(ctx);
      const client = getClientFromOAuthState(ctx);
      const { domain } = parseEmail(email);

      const user = {
        // todo: use the user api service when it's deployed to look this up
        name: sub,
        email,
        emailVerified: true,
        avatarUrl: `https://wwwin.cisco.com/dir/photo/zoom/${sub}.jpg`,
      };

      const context2 = createContext({
        ip: context.ip,
        authType: context.state?.auth?.type,
      });

      const result = await accountProvisioner(context2, {
        team: {
          teamId: team?.id,
          // https://github.com/outline/outline/pull/2388#discussion_r681120223
          name: "Wiki",
          domain,
          subdomain: "",
        },
        user,
        authenticationProvider: {
          name: config.id,
          providerId: domain,
        },
        authentication: {
          providerId: sub,
          scopes: [],
        },
      });

      // @ts-expect-error - the types here for passport-custom are wrong for koa
      return done(null, result.user, { ...result, client });
    } catch (err) {
      return done(toError(err), null);
    }
  })
);

router.get(config.id, passportMiddleware(config.id));

export default router;
