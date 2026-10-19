# Adding a Tenant Access Resolver

A step by step guide to give a group of users, a department of your app for example, access
to a tenant without inviting them one by one.

Every detail lives in [Custom Registry, Tenant Access Resolver](configuration-custom-registry.md#15-tenant-access-resolver),
this guide only walks through it in order.

## Before you start

- Users log in at their home tenant and switch inside the app, the resolver is asked on the
  calls they make under the other tenant. See [When it is asked](configuration-custom-registry.md#when-it-is-asked).
- Your app is the source of truth for who belongs to what, and its answer becomes the ACL of
  the user under that tenant.

## Step 1: Build the API

In a service of your app that is in the registry, add a route that tells the gateway if a user
has access to a tenant and with what groups.

1. Read the body the gateway sends, `user`, `tenant` and `subject`.
2. Look up whether `user` belongs to `subject` in your app.
3. Answer with `access` and, when granted, `groups` and `groupsConfig.allowedPackages` for the
   product of the tenant.

The request and the response are in [The API to build](configuration-custom-registry.md#the-api-to-build).

Keep in mind:

- Keep the route out of every package ACL, the gateway calls the service directly.
- It runs on every call the user makes under the tenant, keep it fast.
- Anything but a well formed yes is no access, see [When access is refused](configuration-custom-registry.md#when-access-is-refused).

## Step 2: Add the resolver to the custom registry

In the environment's custom registry, add or edit the entry named `urac` and add your resolver
under `tenantAccessResolvers`, giving it a name, the service, the route and a short timeout.

The fields are in [The resolver](configuration-custom-registry.md#the-resolver).

The name you give it is what tenants refer to, keep it stable. The service, route or timeout can
change later without touching any tenant.

## Step 3: Point the tenant at the resolver

On each tenant the group should reach, set `profile.access` with the resolver name from step 2
and the `subject` your API checks, the department id for example.

See [The tenant](configuration-custom-registry.md#the-tenant).

Whatever edits tenant profiles must keep `access`, `PUT /tenant/profile` replaces the whole
profile.

## Step 4: Check it

With a user of the group, logged in at their home tenant:

1. Call an API of the tenant with their token and the tenant's key. It should succeed with the
   packages your API returned.
2. Call it with a user outside the group. It should fail with error 146, as before.
3. Call it with a user invited to the tenant. Your API is not called, the invitation decides.

If a user of the group gets 146, look for `Tenant access resolver` in the gateway logs, every
failed call is logged with the resolver, the user and the tenant.

Changes in your app apply on the next call. Changes to the tenant profile apply once the key
cache refreshes.

## Before going live

Read [Behaviour](configuration-custom-registry.md#behaviour): what each call costs, what users
see while your service is down, and how invitations and the resolver combine.

## Reference

| Topic | Where |
|-------|-------|
| Full reference | [Custom Registry, Tenant Access Resolver](configuration-custom-registry.md#15-tenant-access-resolver) |
| Where it runs in the pipeline | [MT middleware, uracCheck](middleware/mt.md#6-uraccheck) |
| Code | `mw/mt/urac.js`, `mw/mt/tenantAccess.js` |
| Example test | `test/integration/UC5-tenant-access/index.js`, a mock resolver |
