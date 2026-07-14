import passport from "@outlinewiki/koa-passport";
import type { Context } from "koa";
import Router from "koa-router";
import { Strategy } from "passport-custom";
import { parseEmail } from "@shared/utils/email";
import accountProvisioner from "@server/commands/accountProvisioner";
import { AuthenticationError } from "@server/errors";
import passportMiddleware from "@server/middlewares/passport";
import { AuthenticationResult } from "@server/types";
import {
  getClientFromContext,
  getTeamFromContext,
} from "@server/utils/passport";
import User from "~/models/User";
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
    try {
      const sub = ctx.headers["x-subject"] as string;
      const email = `${sub}@cisco.com`;

      if (!sub) {
        throw AuthenticationError("x-subject header is required");
      }

      const team = await getTeamFromContext(ctx);
      const client = getClientFromContext(ctx);
      const { domain } = parseEmail(email);

      const result = await accountProvisioner({
        ip: ctx.ip,
        team: {
          teamId: team?.id,
          // https://github.com/outline/outline/pull/2388#discussion_r681120223
          name: "Wiki",
          domain,
          subdomain: "",
        },
        user: {
          // todo: use the user api service when it's deployed to look this up
          name: sub,
          email,
          avatarUrl: `https://wwwin.cisco.com/dir/photo/zoom/${sub}.jpg`,
        },
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
      return done(err, null);
    }
  })
);

router.get(config.id, passportMiddleware(config.id));

export default router;
