/* global browser: false */

const AUTH_URL = 'https://www.rememberthemilk.com/services/auth/';
const BASE_URL = 'https://api.rememberthemilk.com/services/rest/';
const API_VERSION = '2';
const FORMAT = 'json';
const INVALID = 'INVALID';

class Milk {

    constructor(data, permissions) {

        this.data = data;
        this.permissions = (permissions) ? permissions : 'write';
        this.hasher = new Hash();
        this.milkAuth = new MilkAuth();
        let me = this;

        if (!data.a || !data.b) {
            throw 'Milk Error: Missing data.';
        }

        let applySettings = (storedSettings) => {
            if (storedSettings.token) {
                me.auth_token = storedSettings.token;
            } else {
                me.auth_token = INVALID;
            }
            if (storedSettings.frob) {
                me.frob = storedSettings.frob;
            } else {
                me.frob = INVALID;
            }
            console.log(`Applied settings: token=${me.auth_token} frob=${me.frob}`);
            this.ensureFrob();
        };

        browser.storage.local.get().then(applySettings, (e) => {
            console.log(`Error getting settings ${e}`);
        });
    }

    /**
     * Check is the user is authenticated.
     *
     * @returns {boolean} true if the frob and token are set
     */
    isUserReady() {
        console.log(`User ready: token=${this.auth_token} frob=${this.frob}`);
        return this.frob !== INVALID && this.auth_token !== INVALID;
    }

	/**
	 * Generates a RTM authentication URL
	 *
	 * @return {String} to send the user to for authorizing
	 */
	getAuthUrl() {
		let params = {
			api_key: this.data.a,
			perms: this.permissions
		};
		params.frob = this.frob;
		return AUTH_URL + this.encodeUrlParams(params);
	};

    //
	// /**
	//  * Gets the timeline ID
	//  *
	//  * @return     Returns the timline ID String
	//  */
	// setTimeline() {
	// 	milkAuth.createTimeline(this).then((response) => {
	// 		this.timeline = response.rsp.timeline;
	// 	}).catch((reason) => {
	// 		console.warn(reason);
	// 	});
	// };

	ensureFrob() {
	    if (this.frob === INVALID) {
            this.milkAuth.getFrob(this).then((response) => {
                console.log(`Setting frob to ${response.rsp.frob}`);
                this.frob = response.rsp.frob;
                browser.storage.local.set({token: this.auth_token, frob: this.frob});
            });
        }
    }

	/**
	 * Main method for making API calls
	 *
	 * @param method    Specifies what API method to be used
	 * @param params    Array of API parameters to accompany the method parameter
	 * @param complete  Callback to fire after the request comes back
	 * @param error     (Optional) Callback to fire if the request fails
	 * @return          Returns the response from the RTM API
	 */
	get(method, params, complete, error) {
		if (!method) {
			throw 'Error: API Method must be defined.';
		}

		if (!params) {
			throw 'Error: API Params must be defined.';
		}

		if (!complete) {
			throw 'Error: API Complete function must be defined.';
		}

		if (!error) {
			error = function () {};
		}

		params.v = API_VERSION;
		params.format = FORMAT;
		params.method = method;

		if (this.auth_token !== INVALID) {
			params.auth_token = this.auth_token;
		}

		if (this.frob !== INVALID) {
			params.frob = this.frob;
		}

		let requestUrl = BASE_URL + this.encodeUrlParams(params);

        //overrideMimeType: 'application/json; charset=utf-8',

        let myHeaders = new Headers([['Content-Type', 'application/json; charset=utf-8']]);
        let fetchInit = {method: 'GET', headers: myHeaders};
		fetch(requestUrl, fetchInit).then((response) => {

		    response.text().then((text) => {
		        console.log('*************************************');
		        console.log(`Request.Url     : ${requestUrl}`);
		        console.log(`Request.Method  : ${method}`);
		        console.log(`Response.Text   : ${text}`);
		        console.log(`        .Status : ${response.status}`);
		        console.log(`        .SText  : ${response.statusText}`);
		        console.log('*************************************');

		        if (response.status === 200) {
		            let jsonData = JSON.parse(text);
		            if (jsonData.rsp.stat === 'ok') {
		                    complete(jsonData);
		            } else {
		                this.handleError(response, error, () => {
		                    this.get(method, params, complete, error);
		                });
		            }
		        } else {
		            this.handleError(response, error, () => {
		                this.get(method, params, complete, error);
		            });
		        }
            });
		});
	};

	handleError(response, error, retry) {
		if (response.status === 200) {
			let rsp = response.json.rsp;
			if (rsp.err && rsp.err.msg && rsp.err.code) {
				if (rsp.err.code === '98') {
					this.auth_token = null;
                    browser.storage.local.set({token: null, frob: this.frob}).then(() => {
                        this.fetchToken(retry, error);
                    });
					return;
				} else if (rsp.err.code === '101') {
					this.auth_token = null;
					this.frob = null;
					browser.storage.local.set({token: null, frob: null}).then(() => {
                        this.ensureFrob();
                    });
				}
			}
			error(`Error ${rsp.err.code}: ${rsp.err.msg}`);
		} else {
			error(`Network Error:${response.status} ${response.statusText}`);
		}
	};

	fetchToken(retry, error) {
		this.milkAuth.getToken(this)
			.then((resp) => {
				this.auth_token = resp.rsp.auth.token;
                browser.storage.local.set({token: resp.rsp.auth.token, frob: this.frob});
				if (retry) {
					retry();
				}
			}).catch((reason) => {
				if (error) {
					error(reason);
				}
			});
	};

	/**
	 * Private - Encodes request parameters into URL format
	 *
	 * @param params    Array of parameters to be URL encoded
	 * @return {string} Returns the URL encoded string of parameters
	 */
	encodeUrlParams(params) {
		params = (params) ? params : {};
		let paramString = '?';
        let firstParam = true;

		params.api_key = this.data.a;

		for (let key in params) {
			if (firstParam) {
				paramString += `${key}=${encodeURIComponent(params[key])}`;
			} else {
				paramString += `&${key}=${encodeURIComponent(params[key])}`;
			}
			firstParam = false;
		}

		paramString += this.generateSig(params);
		return paramString;
	};

	/**
	 * Private - Generates a URL encoded authentication signature
	 *
	 * @param params    The parameters used to generate the signature
	 * @return {string} Returns the URL encoded authentication signature
	 */
	generateSig(params) {
		params = (params) ? params : {};
		let signature = '';
		let keys = Object.keys(params);

		keys.sort();
		for (let i = 0; i < keys.length; i++) {
			signature += keys[i] + params[keys[i]];
		}
		signature = this.data.b + signature;

		return `&api_sig=${this.hasher.md5(signature)}`;
	};

}
