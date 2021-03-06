import * as moxios from "moxios";
import BunqJSClient from "../../src/BunqJSClient";

import CustomDb from "../TestHelpers/CustomDb";
import { randomHex } from "../TestHelpers/RandomData";
import Prepare from "../TestHelpers/Prepare";
import {
    oauthUserAuthorization,
    installationRegistration,
    deviceServerRegistration,
    sessionRegistration,
    defaultResponse,
    errorResponse
} from "../TestHelpers/DefaultResponses";

import { default as apiInstallation, installToken, serverPublicKeyPem } from "../TestData/api-installation";
import { default as apiDeviceServer, deviceId } from "../TestData/api-device-server";
import {
    default as apiSessionRegistration,
    sessionId,
    sessionToken,
    sessionTokenId
} from "../TestData/api-session-registration";
import { default as apiOauthSessionRegistration } from "../TestData/api-user-oauth";
import SetupApp from "../TestHelpers/SetupApp";

const FAKE_API_KEY = randomHex(64);
const FAKE_ENCRYPTION_KEY = randomHex(32);
const FAKE_ENCRYPTION_KEY2 = randomHex(32);

describe("BunqJSClient", () => {
    beforeAll(async done => {
        await Prepare();
        done();
    });

    beforeEach(function() {
        moxios.install();
    });

    afterEach(function() {
        moxios.uninstall();
    });

    describe("#construct()", () => {
        it("should create a new instance", () => {
            const app = new BunqJSClient(new CustomDb("construct1"));
            expect(app).toBeInstanceOf(BunqJSClient);
        });

        it("should throw an error if a new instance is created without a custom storage interface", () => {
            expect(() => {
                new BunqJSClient();
            }).toThrow();
        });
    });

    describe("#run()", () => {
        it("run with default options", async () => {
            const app = new BunqJSClient(new CustomDb("run1"));

            await app.run(FAKE_API_KEY);

            expect(app.Session.environment).toBe("SANDBOX");
            expect(app.Session.apiKey).toBe(FAKE_API_KEY);
            expect(app.Session.encryptionKey).toBeFalsy();
        });

        it("run with custom options", async () => {
            const app = new BunqJSClient(new CustomDb("run2"));

            await app.run(FAKE_API_KEY, [], "SANDBOX", FAKE_ENCRYPTION_KEY);

            expect(app.Session.environment).toBe("SANDBOX");
            expect(app.Session.apiKey).toBe(FAKE_API_KEY);
            expect(app.Session.encryptionKey).toBe(FAKE_ENCRYPTION_KEY);
        });
    });

    describe("#setKeepAlive()", () => {
        it("should be false and true after using the function", async () => {
            const app = new BunqJSClient(new CustomDb("setKeepAlive1"));

            app.setKeepAlive(false);

            expect(app.keepAlive).toBeFalsy();

            app.setKeepAlive(true);

            expect(app.keepAlive).toBeTruthy();
        });
    });

    describe("#setRequestProxies()", () => {
        it("should set a different list of request proxies", async () => {
            const app = new BunqJSClient(new CustomDb("setRequestProxies1"));

            app.setRequestProxies([false]);
        });
    });

    describe("#install()", () => {
        it("installation without stored data", async () => {
            const app = new BunqJSClient(new CustomDb("install1"));
            await app.run(FAKE_API_KEY, [], "SANDBOX", FAKE_ENCRYPTION_KEY);

            const installPromise = app.install();

            await new Promise((resolve, reject) => {
                moxios.wait(() => {
                    moxios.requests
                        .mostRecent()
                        .respondWith(apiInstallation())
                        .then(resolve)
                        .catch(reject);
                });
            });
            await installPromise;

            // re-run, it should be done instantly since the device registration is done already
            await app.install();

            expect(app.Session.installToken).toBe(installToken);
            expect(app.Session.serverPublicKeyPem).toBe(serverPublicKeyPem);
        });

        it("installation without session public key", async () => {
            const app = new BunqJSClient(new CustomDb("install2"));
            await app.run(FAKE_API_KEY, [], "SANDBOX", FAKE_ENCRYPTION_KEY);

            // forcibly remove public key
            app.Session.publicKey = false;

            const installPromise = app.install();

            // expect it to reject
            expect(installPromise).rejects.toBeTruthy();
        });
    });

    describe("#registerDevice()", () => {
        it("device registration without stored data", async () => {
            const app = new BunqJSClient(new CustomDb("device1"));
            await app.run(FAKE_API_KEY, [], "SANDBOX", FAKE_ENCRYPTION_KEY);

            const installationPromise = app.install();
            const installationHandler = installationRegistration(moxios);
            await installationPromise;
            await installationHandler;

            const deviceRegistrationPromise = app.registerDevice();

            await new Promise((resolve, reject) => {
                moxios.wait(() => {
                    moxios.requests
                        .mostRecent()
                        .respondWith(apiDeviceServer(true))
                        .then(resolve)
                        .catch(reject);
                });
            });
            await deviceRegistrationPromise;

            // re-run, it should be done instantly since the installationRegistration is done already
            await app.registerDevice();

            expect(app.Session.deviceId === deviceId).toBeTruthy();
        });

        it("device registration rejects request with status 400 and resets session data", async () => {
            const app = new BunqJSClient(new CustomDb("device2"));
            await app.run(FAKE_API_KEY, [], "SANDBOX", FAKE_ENCRYPTION_KEY);

            const installationPromise = app.install();
            const installationHandler = installationRegistration(moxios);
            await installationPromise;
            await installationHandler;

            const deviceRegistrationPromise = app.registerDevice();

            new Promise((resolve, reject) => {
                moxios.wait(() => {
                    moxios.requests
                        .mostRecent()
                        .respondWith(apiDeviceServer(400))
                        .then(resolve)
                        .catch(reject);
                });
            });

            await expect(deviceRegistrationPromise).rejects.toBeTruthy();
        });

        it("device registration rejects request with status 500", async () => {
            const app = new BunqJSClient(new CustomDb("device3"));
            await app.run(FAKE_API_KEY, [], "SANDBOX", FAKE_ENCRYPTION_KEY);

            const installationPromise = app.install();
            const installationHandler = installationRegistration(moxios);
            await installationPromise;
            await installationHandler;

            const deviceRegistrationPromise = app.registerDevice();

            new Promise((resolve, reject) => {
                moxios.wait(() => {
                    moxios.requests
                        .mostRecent()
                        .respondWith(apiDeviceServer(500))
                        .then(resolve)
                        .catch(reject);
                });
            });

            await expect(deviceRegistrationPromise).rejects.toBeTruthy();
        });
    });

    describe("#registerSession()", () => {
        it("session registration without stored data", async () => {
            const app = new BunqJSClient(new CustomDb("session1"));
            await app.run(FAKE_API_KEY, [], "SANDBOX", FAKE_ENCRYPTION_KEY);

            // installationRegistration
            const installationPromise = app.install();
            const installationHandler = installationRegistration(moxios);
            await installationPromise;
            await installationHandler;

            // device registration
            const devicePromise = app.registerDevice();
            const deviceHandler = deviceServerRegistration(moxios);
            await devicePromise;
            await deviceHandler;

            const sessionRegistrationPromise = app.registerSession();

            await new Promise((resolve, reject) => {
                moxios.wait(() => {
                    moxios.requests
                        .mostRecent()
                        .respondWith(apiSessionRegistration(true))
                        .then(resolve)
                        .catch(reject);
                });
            });
            await sessionRegistrationPromise;

            // re-run, it should be done instantly since the installationRegistration is done already
            await app.registerSession();

            expect(app.Session.sessionId).toBe(sessionId);
            expect(app.Session.sessionToken).toBe(sessionToken);
            expect(app.Session.sessionTokenId).toBe(sessionTokenId);
            expect(app.Session.userInfo).not.toBe({});
        });

        it("session registration without stored data and UserLight response", async () => {
            const app = new BunqJSClient(new CustomDb("session2"));
            await app.run(FAKE_API_KEY, [], "SANDBOX", FAKE_ENCRYPTION_KEY);

            // installationRegistration
            const installationPromise = app.install();
            const installationHandler = installationRegistration(moxios);
            await installationPromise;
            await installationHandler;

            // device registration
            const devicePromise = app.registerDevice();
            const deviceHandler = deviceServerRegistration(moxios);
            await devicePromise;
            await deviceHandler;

            const sessionRegistrationPromise = app.registerSession();

            await new Promise((resolve, reject) => {
                moxios.wait(() => {
                    moxios.requests
                        .mostRecent()
                        .respondWith(apiSessionRegistration(true, "UserLight"))
                        .then(resolve)
                        .catch(reject);
                });
            });
            await sessionRegistrationPromise;

            // re-run, it should be done instantly since the installationRegistration is done already
            await app.registerSession();

            expect(app.Session.sessionId).toBe(sessionId);
            expect(app.Session.sessionToken).toBe(sessionToken);
            expect(app.Session.sessionTokenId).toBe(sessionTokenId);
            expect(app.Session.userInfo).not.toBe({});
        });

        it("session registration without stored data and UserPerson response", async () => {
            const app = new BunqJSClient(new CustomDb("session3"));
            await app.run(FAKE_API_KEY, [], "SANDBOX", FAKE_ENCRYPTION_KEY);

            // installationRegistration
            const installationPromise = app.install();
            const installationHandler = installationRegistration(moxios);
            await installationPromise;
            await installationHandler;

            // device registration
            const devicePromise = app.registerDevice();
            const deviceHandler = deviceServerRegistration(moxios);
            await devicePromise;
            await deviceHandler;

            const sessionRegistrationPromise = app.registerSession();

            await new Promise((resolve, reject) => {
                moxios.wait(() => {
                    moxios.requests
                        .mostRecent()
                        .respondWith(apiSessionRegistration(true, "UserPerson"))
                        .then(resolve)
                        .catch(reject);
                });
            });
            await sessionRegistrationPromise;

            // re-run, it should be done instantly since the installationRegistration is done already
            await app.registerSession();

            expect(app.Session.sessionId).toBe(sessionId);
            expect(app.Session.sessionToken).toBe(sessionToken);
            expect(app.Session.sessionTokenId).toBe(sessionTokenId);
            expect(app.Session.userInfo).not.toBe({});
        });

        it("session registration fails if invalid user type is returned", async () => {
            const app = new BunqJSClient(new CustomDb("session4"));
            await app.run(FAKE_API_KEY, [], "SANDBOX", FAKE_ENCRYPTION_KEY);

            // installationRegistration
            const installationPromise = app.install();
            const installationHandler = installationRegistration(moxios);
            await installationPromise;
            await installationHandler;

            // device registration
            const devicePromise = app.registerDevice();
            const deviceHandler = deviceServerRegistration(moxios);
            await devicePromise;
            await deviceHandler;

            const sessionRegistrationPromise = app.registerSession();

            new Promise((resolve, reject) => {
                moxios.wait(() => {
                    moxios.requests
                        .mostRecent()
                        .respondWith(apiSessionRegistration(true, "UserPersonInvalid"))
                        .then(resolve)
                        .catch(reject);
                });
            });

            // wait for it to reject
            await expect(sessionRegistrationPromise).rejects.toBeTruthy();
        });

        it("session registration rejects if request fails with status 500", async () => {
            const app = new BunqJSClient(new CustomDb("session5"));
            await app.run(FAKE_API_KEY, [], "SANDBOX", FAKE_ENCRYPTION_KEY);

            // installationRegistration
            const installationPromise = app.install();
            const installationHandler = installationRegistration(moxios);
            await installationPromise;
            await installationHandler;

            // device registration
            const devicePromise = app.registerDevice();
            const deviceHandler = deviceServerRegistration(moxios);
            await devicePromise;
            await deviceHandler;

            const sessionRegistrationPromise = app.registerSession();

            new Promise((resolve, reject) => {
                moxios.wait(() => {
                    moxios.requests
                        .mostRecent()
                        .respondWith(apiSessionRegistration(500))
                        .then(resolve)
                        .catch(reject);
                });
            });

            // wait for it to reject
            await expect(sessionRegistrationPromise).rejects.toBeTruthy();
        });

        it("session registration rejects if request fails with status 400", async () => {
            const app = new BunqJSClient(new CustomDb("session6"));
            await app.run(FAKE_API_KEY, [], "SANDBOX", FAKE_ENCRYPTION_KEY);

            // installationRegistration
            const installationPromise = app.install();
            const installationHandler = installationRegistration(moxios);
            await installationPromise;
            await installationHandler;

            // device registration
            const devicePromise = app.registerDevice();
            const deviceHandler = deviceServerRegistration(moxios);
            await devicePromise;
            await deviceHandler;

            const sessionRegistrationPromise = app.registerSession();

            new Promise((resolve, reject) => {
                moxios.wait(() => {
                    moxios.requests
                        .mostRecent()
                        .respondWith(apiSessionRegistration(400))
                        .then(resolve)
                        .catch(reject);
                });
            });

            // wait for it to reject
            await expect(sessionRegistrationPromise).rejects.toBeTruthy();
        });

        it("session registration rejects if request fails with status 400", async () => {
            const app = new BunqJSClient(new CustomDb("session6"));
            await app.run(FAKE_API_KEY, [], "SANDBOX", FAKE_ENCRYPTION_KEY);

            // installationRegistration
            const installationPromise = app.install();
            const installationHandler = installationRegistration(moxios);
            await installationPromise;
            await installationHandler;

            // device registration
            const devicePromise = app.registerDevice();
            const deviceHandler = deviceServerRegistration(moxios);
            await devicePromise;
            await deviceHandler;

            const sessionRegistrationPromise = app.registerSession();

            new Promise((resolve, reject) => {
                moxios.wait(() => {
                    moxios.requests
                        .mostRecent()
                        .respondWith(apiOauthSessionRegistration())
                        .then(resolve)
                        .catch(reject);
                });
            });

            // wait for it to reject
            await expect(sessionRegistrationPromise).resolves.toBeTruthy();
        });
    });

    describe("#changeEncryptionKey()", () => {
        it("change the stored data with a new encryption key", async () => {
            const bunqApp: BunqJSClient = await SetupApp("ChangeEncryptionKey");

            // create new credentials
            await bunqApp.changeEncryptionKey(FAKE_ENCRYPTION_KEY2);

            expect(bunqApp.Session.encryptionKey).toBe(FAKE_ENCRYPTION_KEY2);
        });

        it("change to a new invalid encryption key", async () => {
            const bunqApp: BunqJSClient = await SetupApp("ChangeEncryptionKey2");
            expect.assertions(1);

            // change to invalid encryption key
            await expect(bunqApp.changeEncryptionKey("invalid - key")).rejects.toBeInstanceOf(Error);
        });
    });

    describe("#createCredentials()", () => {
        it("create a new credential", async () => {
            const bunqApp: BunqJSClient = await SetupApp("CreateCredentials");

            // create new credentials
            const checkCredentialStatus = bunqApp.createCredentials();

            // return a default response
            await defaultResponse(moxios);

            // wait for credential status
            await checkCredentialStatus;
        });
    });

    describe("#checkCredentialStatus()", () => {
        it("check the status of a set of credentials", async () => {
            const bunqApp: BunqJSClient = await SetupApp("CheckCredentialStatus");

            // create new credentials
            const checkCredentialStatus = bunqApp.checkCredentialStatus("UUID");

            // return a default response
            await defaultResponse(moxios);

            // wait for credential status
            await checkCredentialStatus;
        });
    });

    describe("#destroySession()", () => {
        it("create a session and remove it", async () => {
            const app = new BunqJSClient(new CustomDb("destroySession"));
            await app.run(FAKE_API_KEY, [], "SANDBOX", FAKE_ENCRYPTION_KEY);

            // installationRegistration
            const installationPromise = app.install();
            const installationHandler = installationRegistration(moxios);
            await installationPromise;
            await installationHandler;

            // device registration
            const devicePromise = app.registerDevice();
            const deviceHandler = deviceServerRegistration(moxios);
            await devicePromise;
            await deviceHandler;

            // session registration
            const sessionPromise = app.registerSession();
            const sessionHandler = sessionRegistration(moxios);
            await sessionPromise;
            await sessionHandler;

            // first check if the values are currently set
            expect(app.Session.sessionId).toBe(sessionId);
            expect(app.Session.sessionToken).toBe(sessionToken);
            expect(app.Session.sessionTokenId).toBe(sessionTokenId);
            expect(Object.keys(app.Session.userInfo).length > 0).toBeTruthy();

            const destroySessionPromise = app.destroySession();
            await new Promise((resolve, reject) => {
                moxios.wait(() => {
                    moxios.requests
                        .mostRecent()
                        .respondWith({
                            status: 200,
                            response: true
                        })
                        .then(resolve)
                        .catch(reject);
                });
            });
            await destroySessionPromise;

            // the values should be unset now and either null/empty
            expect(app.Session.sessionId).toBeNull();
            expect(app.Session.sessionToken).toBeNull();
            expect(app.Session.sessionTokenId).toBeNull();
            expect(Object.keys(app.Session.userInfo).length === 0).toBeTruthy();
        });
    });

    describe("#exchangeOAuthToken()", () => {
        it("should request oauth authorization and return an access token", async () => {
            const app = await SetupApp("exchangeOAuthToken1");

            const request = app.exchangeOAuthToken(
                "clientId",
                "clientSecret",
                "redirectUri",
                "codeValue",
                false,
                false,
                "authorization_code"
            );
            await oauthUserAuthorization(moxios);
            const response = await request;

            expect(response).not.toBeNull();
        });

        it("should check the state if set", async () => {
            const app = await SetupApp("exchangeOAuthToken2");

            const request = app.exchangeOAuthToken(
                "clientId",
                "clientSecret",
                "redirectUri",
                "codeValue",
                "some-state-value",
                false,
                "authorization_code"
            );
            await oauthUserAuthorization(moxios);
            const response = await request;

            expect(response).not.toBeNull();
        });

        it("should use default values", async () => {
            const app = await SetupApp("exchangeOAuthToken3");

            const request = app.exchangeOAuthToken("clientId", "clientSecret", "redirectUri", "codeValue");
            await oauthUserAuthorization(moxios);
            const response = await request;

            expect(response).not.toBeNull();
        });

        it("should throw an error if state is invalid", async () => {
            const app = await SetupApp("exchangeOAuthToken4");

            const request = expect(
                app.exchangeOAuthToken(
                    "clientId",
                    "clientSecret",
                    "redirectUri",
                    "codeValue",
                    "some-state-value22",
                    false,
                    "authorization_code"
                )
            ).rejects.toBeInstanceOf(Error);
            await oauthUserAuthorization(moxios);

            await request;
        });
    });

    describe("#formatOAuthAuthorizationRequestUrl()", () => {
        it("should return the required production url for an oauth authorization request", async () => {
            const app = await SetupApp("formatOAuthAuthorizationRequestUrl1");

            const expectedUrl =
                "https://oauth.bunq.com/auth?response_type=code&client_id=clientId&redirect_uri=redirectUri";

            const string = await app.formatOAuthAuthorizationRequestUrl("clientId", "redirectUri", false, false);

            expect(string).toBe(expectedUrl);
        });

        it("should return the required sandbox url for an oauth authorization request", async () => {
            const app = await SetupApp("formatOAuthAuthorizationRequestUrl2");

            const expectedUrl =
                "https://oauth.sandbox.bunq.com/auth?response_type=code&client_id=clientId&redirect_uri=redirectUri";

            const string = await app.formatOAuthAuthorizationRequestUrl("clientId", "redirectUri", false, true);

            expect(string).toBe(expectedUrl);
        });

        it("should return a valid url with default values", async () => {
            const app = await SetupApp("formatOAuthAuthorizationRequestUrl3");

            const expectedUrl =
                "https://oauth.bunq.com/auth?response_type=code&client_id=clientId&redirect_uri=redirectUri";

            const string = await app.formatOAuthAuthorizationRequestUrl("clientId", "redirectUri");

            expect(string).toBe(expectedUrl);
        });

        it("should return a valid url with a custom state", async () => {
            const app = await SetupApp("formatOAuthAuthorizationRequestUrl4");

            const expectedUrl =
                "https://oauth.bunq.com/auth?response_type=code&client_id=clientId&redirect_uri=redirectUri&state=state_value";

            const string = await app.formatOAuthAuthorizationRequestUrl("clientId", "redirectUri", "state_value");

            expect(string).toBe(expectedUrl);
        });
    });

    describe("#formatOAuthKeyExchangeUrl()", () => {
        it("should return the required production url for an oauth token exchange request", async () => {
            const app = await SetupApp("formatOAuthKeyExchangeUrl1");

            const expectedUrl =
                "https://api.oauth.bunq.com/v1/token?grant_type=authorization_code&code=received_code&client_id=clientId&client_secret=clientSecret&redirect_uri=redirectUri";

            const string = await app.formatOAuthKeyExchangeUrl(
                "clientId",
                "clientSecret",
                "redirectUri",
                "received_code",
                false,
                "authorization_code"
            );

            expect(string).toBe(expectedUrl);
        });

        it("should return the required sandbox url for an oauth token exchange request", async () => {
            const app = await SetupApp("formatOAuthKeyExchangeUrl2");

            const expectedUrl =
                "https://api-oauth.sandbox.bunq.com/v1/token?grant_type=authorization_code&code=received_code&client_id=clientId&client_secret=clientSecret&redirect_uri=redirectUri";

            const string = await app.formatOAuthKeyExchangeUrl(
                "clientId",
                "clientSecret",
                "redirectUri",
                "received_code",
                true,
                "authorization_code"
            );

            expect(string).toBe(expectedUrl);
        });

        it("should return a valid url with default values", async () => {
            const app = await SetupApp("formatOAuthKeyExchangeUrl3");

            const expectedUrl =
                "https://api.oauth.bunq.com/v1/token?grant_type=authorization_code&code=received_code&client_id=clientId&client_secret=clientSecret&redirect_uri=redirectUri";

            const string = await app.formatOAuthKeyExchangeUrl(
                "clientId",
                "clientSecret",
                "redirectUri",
                "received_code"
            );

            expect(string).toBe(expectedUrl);
        });
    });

    describe("#setExpiryTimer()", () => {
        it("should setup a timer", async () => {
            const app = await SetupApp("setExpiryTimer1");
            app.setKeepAlive(true);

            app.setExpiryTimer(false, true);
        });

        it("should do nothing if sessionExpiryTime isn't set", async () => {
            const app = await SetupApp("setExpiryTimer2");
            app.Session.sessionExpiryTime = null;
            app.setKeepAlive(true);

            app.setExpiryTimer(false, true);
        });

        it("should do nothing if keepAlive is false", async () => {
            const app = await SetupApp("setExpiryTimer3");
            app.setKeepAlive(false);

            app.setExpiryTimer(false, true);
        });
    });

    describe("#clearExpiryTimer()", () => {
        it("should do a User API call", async () => {
            const app = await SetupApp("clearExpiryTimer1");
            app.Session.sessionExpiryTimeChecker = new Date();

            app.clearExpiryTimer();
        });
    });

    describe("#expiryTimerCallback()", () => {
        it("should do a User API call", async () => {
            const app = await SetupApp("expiryTimerCallback1");
            app.setKeepAlive(true);

            app.expiryTimerCallback();
            await defaultResponse(moxios);
        });

        it("should do nothing is keepAlive is false when called", async () => {
            const app = await SetupApp("expiryTimerCallback2");
            app.setKeepAlive(false);

            app.expiryTimerCallback();
        });

        it("should fail silently and log to console", async () => {
            const app = await SetupApp("expiryTimerCallback3");
            app.setKeepAlive(true);

            app.expiryTimerCallback();
            await errorResponse(moxios);
        });
    });

    describe("#destroyApiSession()", () => {
        it("should return a list with one UserCompany object", async () => {
            const app = await SetupApp("DestroyApiSession1");

            await app.destroyApiSession();
        });
    });

    describe("#getUser()", () => {
        it("should return UserCompany object", async () => {
            const app = await SetupApp("GetUser");

            const userInfo = await app.getUser("UserCompany", false);

            expect(userInfo.id).toBe(42);
            expect(userInfo.name).toBe("bunq");
        });

        it("should return undefined", async () => {
            const app = await SetupApp("GetUser2");

            const userInfo = await app.getUser("InvalidType", false);

            expect(userInfo).toBe(undefined);
        });

        it("should do an api call if force mode is set", async () => {
            const app = await SetupApp("GetUser3");

            const getUserPromise = app.getUser("UserCompany", true);

            // return a default response
            await defaultResponse(moxios);

            await expect(getUserPromise).resolves.toBeTruthy();
        });
    });

    describe("#getUsers()", () => {
        it("should return a list with one UserCompany object", async () => {
            const app = await SetupApp("GetUsers");

            const users = await app.getUsers(false);

            expect(Object.keys(users).length >= 1).toBeTruthy();

            const userInfo = users.UserCompany;

            expect(userInfo.id).toBe(42);
            expect(userInfo.name).toBe("bunq");
        });

        it("should do an api call if force mode is set", async () => {
            const app = await SetupApp("GetUsers2");

            const getUsersPromise = app.getUsers(true);

            // return a default response
            await defaultResponse(moxios);

            await expect(getUsersPromise).resolves.toBeTruthy();
        });
    });
});
