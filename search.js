// newest first switch on/off
let newest_first = false;
// search result list
let result_list = [];
// the active knowledge-base
let kb = null;
let source_list = [];    // list of all sources
let source_values = {};     // list of selected source-id -> bool
let source_counts = {};     // list source-id -> count
// pagination
let currentPage = 0;
// number of documents found by search (grand total)
let num_documents = 0;
// have we signed in?
let signed_in = false;
const archive_marker = ":::";

// define the Keycloak basic class for SimSage (see settings.js)
const keycloak = new Keycloak({
    url: window.ENV.kc_endpoint,
    realm: window.ENV.kc_realm,
    clientId: window.ENV.kc_client_id,
    onLoad: 'check-sso',
    //redirectUri: window.location.href,
    KeycloakResponseType: 'code',
    checkLoginIframe: false,
});


/**
 * login in automatically
 */
function auto_login() {
    if (!signed_in) {
        setTimeout(() => {
            if (keycloak && !signed_in)
                keycloak.login({redirectUri: window.location.href});
        }, 1000)
    }
}

/**
 * display a generic error message
 *
 * @param message
 * @param error
 */
function set_error(message, error) {
    if (error) {
        message += ": " + error.toString();
    }
    console.error(message);
    $("#errorMessage").text(message);
    $("#alertDialog").removeClass("d-none").addClass("show");
    if (message === "no session") {
        setTimeout(() => {
            auto_login()
        }, 2000)
    }
}

/**
 * authentication error - reset cookies and search screen
 */
function reset_auth() {
    set_cookie("session", "", -1)
    set_cookie("kc", "", -1)
    reset_search();
    auto_login();
}


/**
 * get search info (source info etc.)
 */
function get_search_info(success_callback) {
    const session_id = get_session_id();
    if (!session_id) {
        set_error("no session", null); // no session, can't search, no security
        return;
    }
    const url = window.ENV.api_base + '/knowledgebase/search/info/' +
        encodeURIComponent(window.ENV.organisation_id) + '/' +
        encodeURIComponent(get_client_id());

    $.ajax({
        url: url,
        type: 'GET',
        headers: {
            "API-Version": window.ENV.api_version,
            "Content-Type": "application/json",
            "session-id": session_id
        },
        success: function(response) {
            if (success_callback) {
                success_callback(response);
            }
        },
        error: function(xhr) {
            set_error('search failed', xhr.responseText)
        }
    });
}


/**
 * perform a search - set result_list and num_documents accordingly
 *
 * @param text                  the text to search for
 * @param filter                metadata filter (currently always empty)
 * @param newest_first          show newest first in a search?
 * @param page                  the page to start on/from, zero indexed
 * @param shard_list            a list of shards to pass back and forth in a multi-sharded system
 * @param success_callback      if successful, then call this function (if it is set)
 */
function search(text,
                filter,
                newest_first,
                page,
                shard_list,
                success_callback
) {
    const session_id = get_session_id();
    if (!session_id) {
        set_error("no session", null); // no session, can't search, no security
        return;
    }
    if (!text || text.trim().length < 2) {
        console.log("not enough text to search"); // empty text?
        return;
    }

    // get search info for display?
    if (source_list.length === 0 || !kb) {
        get_search_info((response) => {
            if (response && response.kbList && response.kbList.length > 0) {
                kb = response.kbList.find((kb) => kb.id === window.ENV.kb_id);
                if (kb) {
                    source_list = kb.sourceList ?? [];
                } else {
                    source_list = [];
                }
            }
        });
    }

    // set up source selection filter
    let filters = "";
    const source_id_list = [];
    for (const key in source_values) {
        if (source_values.hasOwnProperty(key)) {
            if (source_values[key] === true) {
                source_id_list.push(key);
            }
        }
    }
    if (source_id_list.length > 0) {
        filters = "(source(" + source_id_list.join(",") + "))"
    }

    const url = window.ENV.api_base + '/semantic/query';
    const data = {
        organisationId: window.ENV.organisation_id,
        kbList: [window.ENV.kb_id],
        scoreThreshold: window.ENV.score_threshold,
        clientId: get_client_id(),
        semanticSearch: true,
        query: text,
        filter: filters,
        numResults: 1,
        page: page,
        pageSize: window.ENV.page_size,
        shardSizeList: shard_list,
        fragmentCount: window.ENV.fragment_count,
        maxWordDistance: window.ENV.max_word_distance,
        spellingSuggest: window.ENV.use_spell_checker,
        useInsight: window.ENV.use_insight,
        contextLabel: '',
        contextMatchBoost: 0.01,
        groupSimilarDocuments: false,
        sortByAge: newest_first,
        sourceId: '',
        useQuestionAnsweringAi: window.ENV.use_ai,
        wordSynSet: {}
    };

    $.ajax({
        url: url,
        type: 'POST',
        data: JSON.stringify(data),
        headers: {
            "API-Version": window.ENV.api_version,
            "Content-Type": "application/json",
            "session-id": session_id
        },
        success: function(response) {
            // set source counts
            if (response.sourceIdToCounts) {
                source_counts = response.sourceIdToCounts;
            } else {
                source_counts = {};
            }
            if (success_callback) {
                success_callback(response);
            }
        },
        error: function(xhr) {
            set_error('search failed', xhr.responseText)
        }
    });

}


/**
 * return the URL for a preview image given a search result
 *
 * @param result        the search result to get a preview image for
 * @returns {string}    the url for the image (or empty string)
 */
function preview_image_url(result) {
    if (!result)
        return;
    const session_id = get_session_id();
    if (!session_id) {
        console.log("no session");
        return;
    }
    if (result && result.urlId) {
        return window.ENV.api_base + "/document/preview/" + window.ENV.organisation_id + "/" +
            window.ENV.kb_id + "/" + get_client_id() + "/" + session_id + "/" + result.urlId
    } else {
        return "";
    }
}


/**
 * highlight search result text
 *
 * @param text_list         a text list of the search results to apply highlighting to
 * @returns {*|string}      the first item of the text list (if present) with proper css set
 */
function highlight(text_list) {
    if (text_list && text_list.length > 0) {
        return text_list[0]
            .replace(/{hl1:}/g, "<span class=\"search-primary\">")
            .replace(/{:hl1}/g, "</span>")
            .replace(/{hl2:}/g, "<span class=\"search-secondary\">")
            .replace(/{:hl2}/g, "</span>");
    }
    return "";
}

// create a four digit random hex number
function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
}

// create a guid
function guid() {
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

// create a client-id for the search UX, representing a unique id for this user (but random)
function get_client_id() {
    let client_id = get_cookie("client_id");
    if (client_id && client_id.length > 0)
        return client_id;
    // dne - create a new one
    client_id = guid();
    // set a one-month cookie
    set_cookie("client_id", client_id, 31 * 24 * 60);
    return client_id;
}


/**
 * set a cookie for this app
 *
 * @param name      the name of the value
 * @param value     the value to set (a string)
 * @param minutes   how many minutes this is valid for
 */
function set_cookie(name, value, minutes = 30) {
    const date = new Date();
    date.setTime(date.getTime() + (minutes * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/;SameSite=Lax";
}

/**
 * get a cookie for this app
 *
 * @param name              the name of the cookie to get
 * @returns {null|string}   null if dne, otherwise the cookie string
 */
function get_cookie(name) {
    const nameEQ = name + "=";
    const cookiesArray = document.cookie.split(';');
    for (let i = 0; i < cookiesArray.length; i++) {
        let cookie = cookiesArray[i].trim();
        if (cookie.indexOf(nameEQ) === 0) {
            return cookie.substring(nameEQ.length, cookie.length);
        }
    }
    return null;
}


/**
 * get a SimSage session ID from the cookies if it exists
 *
 * @returns {*|null}    the SimSage session_id if it exists, otherwise null
 */
function get_session_id() {
    const session_id = get_cookie("session");
    if (session_id && session_id.length > 0) {
        return session_id;
    }
    return null;
}


/**
 * Sign in to SimSage using a keycloak JWT
 *
 * @param kc_id_token       the keycloak JWT
 * @param on_success        callback on success
 * @param on_fail           sign-in failed callback
 */
function sign_in(kc_id_token, on_success, on_fail) {
    console.log("Signing in")
    const url = window.ENV.api_base + '/auth/search/authenticate/msal/' + encodeURIComponent(window.ENV.organisation_id);
    $.ajax({
        url: url,
        type: 'GET',
        headers: {
            "API-Version": window.ENV.api_version,
            "Content-Type": "application/json",
            "jwt": "" + kc_id_token,
        },
        success: function(response) {
            if (response && response.user && response.session && response.session.id) {
                signed_in = true;
                console.log("Signed in");
                set_cookie("session", response.session.id, window.ENV.session_length_in_minutes);
                if (on_success) {
                    on_success();
                }
            }
        },
        error: function(xhr) {
            set_error('sign-in failed', xhr.responseText)
            if (on_fail) {
                on_fail()
            }
        }
    });
}


/**
 * force set a query string parameter q=... inside the browser
 *
 * @param q the text to set to q=, empty string deletes the parameter
 */
function update_query_string_param(q) {
    const url = new URL(window.location);
    if (!q || q.trim().length === 0)
        url.searchParams.delete('q');
    else
        url.searchParams.set('q', q);
    window.history.replaceState({}, '', url);
}


/**
 * display the ordinary search results as 10 blue lines
 *
 * @param data
 */
function display_search_results(data) {
    // set up the search results display
    if (data && data.resultList) {
        result_list = data.resultList;
        num_documents = data.totalDocumentCount;
        display_results();
        setup_sources();
        setup_pagination("pagination-top");
        if (num_documents > 4) {
            setup_pagination("pagination-bottom");
        } else {
            $('#pagination-bottom').empty();
        }
    }
}


/**
 * display any AI responses given by data response of search
 *
 * @param data
 */
function display_ai(data) {
    if (data) {
        // display AI dialog if we have some AI text to display
        const ai_dialog = $('#aiDialog');
        const ai_text = $('#aiContent');
        ai_text.empty();
        if (data && (data.qnaAnswer || data.qnaInsight)) {
            const text = data.qnaAnswer ? data.qnaAnswer : data.qnaInsight;
            text.split("\n").map((text) => {
                if (text.trim().length > 0)
                    ai_text.append(`<div class="dialog-text"><div class="dialog-text" title="${text}">${text}</div></div>`)
            })
            ai_text.append(`<div class="warning-text">Generative AI can make mistakes. Consider checking important information.</div>`)
            ai_dialog.removeClass("d-none").addClass("show");
        } else {
            ai_dialog.addClass("d-none").removeClass("show");
        }
    }
}


/**
 *  perform a SimSage search, read the search string contents and do it
 *  if the query string is empty, the interface is reset to default (empty)
 */
function perform_search() {
    const query = $('#searchQuery').val();
    update_query_string_param(query);
    if (query.trim() === '') {
        reset_search();
        return;
    }
    // do the search
    search(query, '', newest_first, currentPage, [], (data) => {
        // display the 10 blue lines
        display_search_results(data);
        // display AI dialog if we have some AI text to display
        display_ai(data);
    });
}


// is this URL an item inside an archive file-type? (like a zip or a pst file)
function is_archive_file(url) {
    return (url && url.indexOf && url.indexOf(archive_marker) > 0 &&
        url.split && url.split(archive_marker).length === 2);
}

function get_archive_child(url) {
    if (is_archive_file(url)) {
        return url.split(archive_marker)[1];
    }
    return url;
}

// convert a URL to a bread-crumb / item
function url_to_bread_crumb(url) {
    if (url.length > 0) {
        // remove any archive marker content
        if (is_archive_file(url)) {
            url = get_archive_child(url);
        }
        const list = path_from_url(url)
        let str = "";
        for (const item of list) {
            if (str.length > 0) {
                str += " / ";
            }
            str += item;
        }
        if (str === "")
            str = "/";
        return str;
    }
    return "";
}

function is_archive(url) {
    const url_l = (url && url.toLowerCase) ? url.toLowerCase().trim() : '';
    const length4 = url_l.length - 4;
    const length3 = url_l.length - 3;
    return (
        url_l.lastIndexOf('.zip') === length4 ||
        url_l.lastIndexOf('.tgz') === length4 ||
        url_l.lastIndexOf('.gz') === length3 ||
        url_l.lastIndexOf('.tar') === length4
    );
}

function get_archive_child_last(url) {
    if (is_archive_file(url)) {
        const child = url.split(archive_marker)[1];
        const last_index = child.lastIndexOf('/');
        if (last_index && last_index + 1 < child.length) {
            return child.substring(last_index + 1);
        }
        return child;
    }
    return url;
}

function get_archive_parent(url) {
    if (is_archive_file(url)) {
        return url.split(archive_marker)[0];
    }
    return url;
}

// url to path list
function path_from_url(url) {
    const list = [];
    let subPath = url.lastIndexOf('\\') > 0 ? url.replace('\\', '/') : url;
    if (subPath.indexOf('?') > 10) {
        subPath = subPath.substring(0, subPath.indexOf('?'));
    }
    const subPathLwr = subPath.toLowerCase();
    // remove http://.../ from the path
    if (subPathLwr.startsWith("http:") || subPathLwr.startsWith("https:") || subPathLwr.startsWith("ftp:")) {
        const index = subPath.indexOf('/', 9);
        if (index < 9)
            return [];
        subPath = subPath.substring(index);
    }
    const parts = subPath.split('/');
    if (parts[parts.length - 1] === '') { // string ends in / easy - no filename
        for (const part of parts) {
            if (part !== '')
                list.push(part);
        }
    } else if (parts[parts.length - 1].indexOf('.') > 0) { // last part of path appears to be a filename
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (part !== '')
                list.push(part);
        }
    } else {
        // just a path set
        for (const part of parts) {
            if (part !== '')
                list.push(part);
        }
    }
    return list;
}

// pad any single-digit number with a zero
function pad2(item) {
    return ("" + item).padStart(2, '0');
}

function is_viewable(url) {
    return url && url.startsWith && (url.trim().toLowerCase().startsWith(("https://")) ||
        url.trim().toLowerCase().startsWith(("http://"))) && !is_archive_file(url);
}

/**
 * fetch and open a document
 *
 * @param url the document to open, its pk
 * @param session_id a session id to check permissions on the platform
 */
function do_fetch(url, session_id) {
    if (!session_id || session_id.length === 0)
        session_id = "";

    fetch(url, {headers: {"session-id": session_id}})
        .then((response) => response.blob())
        .then((blob) => { // RETRIEVE THE BLOB AND CREATE LOCAL URL
            const _url = window.URL.createObjectURL(blob);
            window.open(_url, "_blank").focus(); // window.open + focus
        }).catch((error) => {
            if (error.response === undefined) {
                set_error('Servers not responding or cannot contact Servers', null);
            } else {
                set_error("error downloading " + url, error.responseText);
            }
        });
}

function download_document(dl_url) {
    const session_id = get_session_id()
    if (is_archive(dl_url)) {
        alert("archive files cannot be downloaded");

    } else if (!session_id || session_id.trim().length === 0) {
        alert("you must sign-in to download documents");

    } else {
        const url = window.ENV.api_base + '/dms/binary/latest/' + encodeURIComponent(window.ENV.organisation_id) + '/' +
            encodeURIComponent(getKbId()) + '/' + window.btoa(unescape(encodeURIComponent(dl_url)));
        do_fetch(url, session_id);
    }
}

// download url (open it or view it)
function download(url) {
    const session_id = get_session_id()
    if (url.length > 0 && is_viewable(url)) {
        const url_lwr = url.toLowerCase();
        // fix Google-drive bug where we added an extra / to the end of /edit or /view
        if (url_lwr.indexOf("google.com") > 0 && (url_lwr.endsWith("/edit/") || url_lwr.endsWith("/view/"))) {
            url = url.substring(0, url.length - 1);
        }
        window.open(url, "_blank");

    } else if (url.length > 0) {
        download_document(url, session_id);
    }
}

// convert unix timestamp to string if it's for a reasonable time in the future
function unix_time_convert(timestamp) {
    if (timestamp > 1000) {
        const a = new Date(parseInt("" + timestamp));
        const year = a.getUTCFullYear();
        if (isNaN(year)) return "";
        const month = a.getUTCMonth() + 1;
        if (isNaN(month)) return "";
        const date = a.getUTCDate();
        if (isNaN(date)) return "";
        const hour = a.getUTCHours();
        const min = a.getUTCMinutes();
        const sec = a.getUTCSeconds();
        return year + '/' + pad2(month) + '/' + pad2(date) + ' ' + pad2(hour) + ':' + pad2(min) + ':' + pad2(sec);
    }
    return "";
}

/**
 * Display the contents of result_list inside the id="results" area of the HTML
 */
function display_results() {
    const $resultsContainer = $('#results');
    $resultsContainer.empty();

    result_list.forEach(result => {
        let url_breadcrumb = url_to_bread_crumb(result.url);
        if (url_breadcrumb === "owa" && result.metadata["{folder}"] && result.metadata["{folder}"].trim().length > 0) {
            url_breadcrumb = url_to_bread_crumb(result.metadata["{folder}"]);
        }
        const url = result.metadata["{url}"] && result.metadata["{url}"].trim().length > 0 ? result.metadata["{url}"] : result.url
        const last_modified = unix_time_convert(result.lastModified);
        let control_str = `<span class="mb-0 result-details-title">${url}</span>`
        if (is_archive_file(url)) {
            control_str = `
            <span>
                <span class="mb-0 result-details-title">${get_archive_child_last(url)}</span>&nbsp;
                <span class="mb-0 text-black result-details-title">inside</span>&nbsp;
                <span class="mb-0 text-black result-details-title">${get_archive_parent(url)}</span>
            </span>`
        }
        let last_modified_str = `<div class="d-flex align-items-center mb-1"><span class="mb-0 result-details">${last_modified}</span><span class="d-flex align-items-center">`
        if (result.author) {
            last_modified_str += `
                <span class="mb-0 result-details mx-2">|</span>
                    <span class="mb-0 result-details">${result.title}</span>
                </span></div>`
        } else {
            last_modified_str += `</div>`
        }
        const resultItem = `
            <div class="d-flex pb-4 mb-3 px-3 col-12">
                <img src="${preview_image_url(result)}" alt="${result.title}"
                    title="download ${url}" 
                    onclick="download('${url}')" class="result-preview d-none d-lg-block pointer-cursor">
                <div class="ms-3 w-100">
                    <div class="d-flex align-items-center text-align-end mb-1"><p class="mb-0 result-breadcrumb me-2">${url_breadcrumb}</p></div>
                    <span class="mb-2 results-filename text-break pointer-cursor" 
                        onclick="download('${url}')" title="download ${result.title}">${result.title}</span>
                    <div class="d-flex align-items-center mb-1">${control_str}</div>
                    ${last_modified_str}
                    <div><p class="small fw-light mb-2">${highlight(result.textList)}</p></div>
                </div>
            </div>`;
        $resultsContainer.append(resultItem);
    });
}

// change source selection
function select_source(source_id, selected) {
    source_values[source_id] = selected;
}

/**
 * set up the source selection filter
 */
function setup_sources() {
    const $sourceContainer = $('#sources');
    $sourceContainer.empty();
    if (source_list && source_list.length > 0) {
        source_list.map((source) => {
            let count = 0;
            if (source_counts.hasOwnProperty(source.sourceId)) {
                count = source_counts[source.sourceId] ?? 0;
            }
            let checked = "unchecked";
            if (source_values[source.sourceId] === true)
                checked = "checked";
            let count_str = "";
            if (count > 0)
                count_str = count.toLocaleString()
            const resultItem = `
                <div class="list-group-item bg-light d-flex ps-3 pe-3 no-select">
                    <input class="form-check-input me-2 min-width" type="checkbox"
                           ${checked}
                           onchange="select_source('${source.sourceId}', event.target.checked)" 
                           />
                    <div class="d-flex justify-content-between flex-fill">
                            <span title="filter search results for only \"${source.name}\" sources."><span>
                            </span>${source.name}</span>
                        <span class="small fst-italic"
                              title="the current results contain ${count} ${source.name} source types."></span>
                        <span class="small fst-italic"
                              title="the current source has ${count} documents.">${count_str}</span>
                    </div>
                </div>`;
            $sourceContainer.append(resultItem);
        })
    }
}


// clear search et alia in the UX
function reset_search() {
    result_list = [];
    num_documents = 0;
    source_counts = {};
    $('#results').empty();
    $('#pagination-top').empty();
    $('#pagination-bottom').empty();
    setup_sources();
}

/**
 * set up a previous, next button and the page / page-size information as well as
 * the number of search results found in the HTML div whose id is...
 *
 * @param id    the id of an HTML div of where to put the pagination information (without the #)
 */
function setup_pagination(id) {
    const totalPages = Math.ceil(num_documents / window.ENV.page_size);
    const $paginationContainer = $('#' + id);
    $paginationContainer.empty();

    const result_text = (num_documents === 1) ? "one result" :
        ((num_documents > 0) ? ("" + num_documents.toLocaleString() + " results") : "No results...");
    const pageText = $('<li class="mt-2 me-4 font-label"></li>');
    pageText.text(result_text);
    $paginationContainer.append(pageText);

    // Previous button
    const prevButton = $('<li class="page-item"><a class="page-link" href="#">Previous</a></li>');
    if (currentPage === 0) {
        prevButton.addClass('disabled');
    } else {
        prevButton.on('click', function () {
            if (currentPage > 0) {
                currentPage--;
                perform_search();
            }
        });
    }
    $paginationContainer.append(prevButton);

    // Next button
    const nextButton = $('<li class="page-item"><a class="page-link" href="#">Next</a></li>');
    if (currentPage + 1 === totalPages) {
        nextButton.addClass('disabled');
    } else {
        nextButton.on('click', function () {
            if (currentPage + 1 < totalPages) {
                currentPage++;
                perform_search();
            }
        });
    }
    $paginationContainer.append(nextButton);

    const total_pages = "page " + (currentPage + 1) + " of " + totalPages;
    const totalPagesCtrl = $('<li class="mt-2 ms-4 font-label"></li>');
    totalPagesCtrl.text(total_pages);
    $paginationContainer.append(totalPagesCtrl);
}


/**
 * call this once keycloak has authenticated
 * this calls SimSage (if it has to) and sets up a session for it
 */
function keycloak_authenticated(on_success) {
    const existing = get_cookie("kc");
    if (existing) {
        console.log('Keycloak Authenticated');
        sign_in(existing, () => {
            if (on_success) {
                on_success()
            }
        }, () => {
            reset_auth()
        });
    } else {
        console.log("no kc cookie");
        auto_login();
    }
}

