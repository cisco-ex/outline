import Router from "@koa/router";

import accountProvisioner from "@server/commands/accountProvisioner";
import { createContext } from "@server/context";
import { AuthenticationError } from "@server/errors";
import { Team, User } from "@server/models";
import { getTeamFromContext } from "@server/utils/passport";
import { AuthenticationType, Client } from "@shared/types/auth";

import config from "../../plugin.json";
import { signIn } from "@server/utils/authentication";

const router = new Router();

router.get(config.id, async (ctx) => {
  const sub = ctx.headers["x-subject"];
  if (!sub || Array.isArray(sub)) {
    throw AuthenticationError(
      "x-subject header is required and must have 1 value"
    );
  }

  const email = sub + "@cisco.com";

  const apiContext = createContext({
    authType: AuthenticationType.APP,
    ip: ctx.ip,
  });

  const [user, team] = await Promise.all([
    User.findOne({
      where: {
        email,
      },
      include: [{ model: Team, as: "team" }],
    }),
    getTeamFromContext(ctx),
  ]);

  const res = await accountProvisioner(apiContext, {
    authentication: {
      providerId: sub,
      scopes: [],
    },
    authenticationProvider: {
      name: config.name,
      providerId: "cisco.com",
    },
    team: {
      teamId: team?.id,
      name: "Docs",
      domain: "cisco",
      subdomain: "",
    },
    user: {
      name: user?.name ?? sub,
      email,
      emailVerified: true,
      avatarUrl: "",
    },
  });

  await signIn(ctx, "rudder", { ...res, client: Client.Web });
});

export default router;
