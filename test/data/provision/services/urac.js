'use strict';
let service = {
    _id: "5cfb05932ac09278709d013f",
    name: "urac",
    group: "SOAJS Core Services",
    maintenance: {
        port: {
            type: "maintenance"
        },
        readiness: "/heartbeat",
        commands: [
            {
                label: "Releoad Registry",
                path: "/reloadRegistry",
                icon: "registry"
            },
            {
                label: "Resource Info",
                path: "/resourceInfo",
                icon: "info"
            }
        ]
    },
    port: 4001,
    requestTimeout: 30,
    requestTimeoutRenewal: 5,
    swagger: false,
    versions: {
        "2": {
            apis: [
                {
                    l: "Login Through Passport",
                    v: "/passport/login/:strategy",
                    m: "get",
                    group: "Guest"
                },
                {
                    l: "Login Through Passport Validate",
                    v: "/passport/validate/:strategy",
                    m: "get",
                    group: "Guest"
                },
                {
                    l: "Validate Register",
                    v: "/join/validate",
                    m: "get",
                    group: "Guest"
                },
                {
                    l: "Forgot Password",
                    v: "/forgotPassword",
                    m: "get",
                    group: "Guest Account Settings"
                },
                {
                    l: "Check If Username Exists",
                    v: "/checkUsername",
                    m: "get",
                    group: "Guest Account Settings"
                },
                {
                    l: "Validate Change Email",
                    v: "/changeEmail/validate",
                    m: "get",
                    group: "Guest Email Account Settings"
                },
                {
                    l: "Get User Info",
                    v: "/account/getUser",
                    m: "get",
                    group: "My Account",
                    groupMain: true
                },
                {
                    l: "Change User Status",
                    v: "/admin/changeUserStatus",
                    m: "get",
                    group: "Administration"
                },
                {
                    l: "List Users",
                    v: "/admin/listUsers",
                    m: "get",
                    group: "Administration",
                    groupMain: true
                },
                {
                    l: "Total Users Count",
                    v: "/admin/users/count",
                    m: "get",
                    group: "Administration"
                },
                {
                    l: "Get User Record",
                    v: "/admin/getUser",
                    m: "get",
                    group: "Administration"
                },
                {
                    l: "List Groups",
                    v: "/admin/group/list",
                    m: "get",
                    group: "Administration"
                },
                {
                    l: "Get all Users & Groups",
                    v: "/admin/all",
                    m: "get",
                    group: "Administration"
                },
                {
                    l: "List Tenants",
                    v: "/tenant/list",
                    m: "get",
                    group: "Tenant"
                },
                {
                    l: "Get user acl info",
                    v: "/tenant/getUserAclInfo",
                    m: "get",
                    group: "Tenant"
                },
                {
                    l: "OpenAM Login",
                    v: "/openam/login",
                    m: "post",
                    group: "Guest"
                },
                {
                    l: "Ldap Login",
                    v: "/ldap/login",
                    m: "post",
                    group: "Guest"
                },
                {
                    l: "Register",
                    v: "/join",
                    m: "post",
                    group: "Guest"
                },
                {
                    l: "Reset Password",
                    v: "/resetPassword",
                    m: "post",
                    group: "Guest Account Settings"
                },
                {
                    l: "Change Password",
                    v: "/account/changePassword",
                    m: "post",
                    group: "My Account"
                },
                {
                    l: "Change Email",
                    v: "/account/changeEmail",
                    m: "post",
                    group: "My Account"
                },
                {
                    l: "Edit Profile",
                    v: "/account/editProfile",
                    m: "post",
                    group: "My Account"
                },
                {
                    l: "Add new User",
                    v: "/admin/addUser",
                    m: "post",
                    group: "Administration"
                },
                {
                    l: "Edit User Record",
                    v: "/admin/editUser",
                    m: "post",
                    group: "Administration"
                },
                {
                    l: "Edit User Config",
                    v: "/admin/editUserConfig",
                    m: "post",
                    group: "Administration"
                },
                {
                    l: "Add new Group",
                    v: "/admin/group/add",
                    m: "post",
                    group: "Administration"
                },
                {
                    l: "Edit Group",
                    v: "/admin/group/edit",
                    m: "post",
                    group: "Administration"
                },
                {
                    l: "Add Users to Group",
                    v: "/admin/group/addUsers",
                    m: "post",
                    group: "Administration"
                },
                {
                    l: "Delete Group",
                    v: "/admin/group/delete",
                    m: "delete",
                    group: "Administration"
                }
            ],
            extKeyRequired: true,
            oauth: true,
            provision_ACL: false,
            urac: false,
            urac_ACL: false,
            urac_Profile: false
        }
    }
};
module.exports = service;