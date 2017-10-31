import ApiAdapter from "../ApiAdapter";
import Session from "../Session";
import ApiEndpointInterface from "../Interfaces/ApiEndpointInterface";
import Amount from "../Types/Amount";
import CounterpartyAlias from "../Types/CounterpartyAlias";
import PaginationOptions from "../Types/PaginationOptions";

type RequestInquiryPostOptions = {
    status: "REVOKED" | false;
    minimum_age: number | false;
    allow_bunqme: boolean;
    redirect_url: string | false;
};

export default class RequestInquiry implements ApiEndpointInterface {
    ApiAdapter: ApiAdapter;
    Session: Session;

    /**
     * @param {ApiAdapter} ApiAdapter
     */
    constructor(ApiAdapter: ApiAdapter) {
        this.ApiAdapter = ApiAdapter;
        this.Session = ApiAdapter.Session;
    }

    /**
     * @param {number} userId
     * @param {number} monetaryAccountId
     * @param {PaymentsListOptions} options
     * @returns {Promise<void>}
     */
    public async list(
        userId: number,
        monetaryAccountId: number,
        options: PaginationOptions = {
            count: 50,
            newer_id: false,
            older_id: false
        }
    ) {
        const params: any = {
            count: options.count
        };

        if (options.newer_id !== false) {
            params.newer_id = options.newer_id;
        }
        if (options.older_id !== false) {
            params.older_id = options.older_id;
        }

        const response = await this.ApiAdapter.get(
            `/v1/user/${userId}/monetary-account/${monetaryAccountId}/request-inquiry`,
            {},
            {
                axiosOptions: {
                    params: params
                }
            }
        );

        // return raw respone image
        return response.Response;
    }

    /**
     * @param {number} userId
     * @param {number} monetaryAccountId
     * @param {string} description
     * @param {Amount} amount_inquired
     * @param {CounterpartyAlias} counterpartyAlias
     * @param {RequestInquiryPostOptions} options
     * @returns {Promise<void>}
     */
    public async post(
        userId: number,
        monetaryAccountId: number,
        description: string,
        amount_inquired: Amount,
        counterpartyAlias: CounterpartyAlias,
        options: RequestInquiryPostOptions = {
            status: false,
            minimum_age: false,
            allow_bunqme: false,
            redirect_url: false
        }
    ) {
        const requestOptions: any = {
            counterparty_alias: counterpartyAlias,
            description: description,
            amount_inquired: amount_inquired,
            allow_bunqme: options.allow_bunqme
        };

        if (options.status !== false) {
            requestOptions.status = options.status;
        }
        if (options.minimum_age !== false) {
            if (options.minimum_age < 12 && options.minimum_age > 100) {
                throw new Error(
                    "Invalid minimum_age. Value has to be 12 <= minimum_age <= 100"
                );
            }
            requestOptions.minimum_age = options.minimum_age;
        }
        if (options.redirect_url !== false) {
            requestOptions.redirect_url = options.redirect_url;
        }

        const response = await this.ApiAdapter.post(
            `/v1/user/${userId}/monetary-account/${monetaryAccountId}/request-inquiry`,
            requestOptions
        );

        // return raw respone image
        return response.Response;
    }
}