import passport from "@outlinewiki/koa-passport";
import type { Request } from "koa";
import Router from "koa-router";
import { Strategy as CustomStrategy } from "passport-custom";
import { toError } from "@shared/utils/error";
import accountProvisioner from "@server/commands/accountProvisioner";
import passportMiddleware from "@server/middlewares/passport";
import type { User } from "@server/models";
import type { AuthenticationResult } from "@server/types";
import {
  getClientFromOAuthState,
  getTeamFromContext,
  getUserFromOAuthState,
} from "@server/utils/passport";
import { parseEmail } from "@shared/utils/email";
import { createContext } from "@server/context";
import { AuthenticationError } from "@server/errors";

import config from "../../plugin.json";

const router = new Router();

const strategy = new CustomStrategy(
  // @ts-expect-error - use Koad request type instead
  async (
    req: Request,
    done: (
      err: Error | null,
      user: User | null,
      result?: AuthenticationResult,
    ) => void,
  ) => {
    const context = req.ctx;

    try {
      const sub = context.headers["x-subject"] as string;
      const email = `${sub}@cisco.com`;

      if (!sub) {
        throw AuthenticationError("x-subject header is required");
      }

      const team = await getTeamFromContext(context);
      const client = getClientFromOAuthState(context);
      const user =
        context.state?.auth?.user ?? (await getUserFromOAuthState(context));

      const { domain } = parseEmail(email);

      const ctx = createContext({
        ip: context.ip,
        user,
        authType: context.state?.auth?.type,
      });

      const result = await accountProvisioner(ctx, {
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

      return done(null, result.user, { ...result, client });
    } catch (err) {
      return done(toError(err), null);
    }
  },
);

passport.use(config.id, strategy);

router.get(config.id, passportMiddleware(config.id));

export default router;
