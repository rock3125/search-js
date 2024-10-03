// the URL must be set for a window to show
let query_ai_focus_url = "";
let query_ai_focus_url_id = 0;
// the title is optional
let query_ai_focus_title = "";
// the list of conversations
let query_ai_dialog_list = [];


/**
 * call the server and get a response
 */
function ask_ai(question) {
    const session_id = get_session_id();
    if (!session_id) {
        set_error("no session", null); // no session, can't search, no security
        return;
    }
    let conversationList = [];
    if (query_ai_dialog_list.length > 1) {
        conversationList = query_ai_dialog_list.slice(1, query_ai_dialog_list.length);
    }
    conversationList.push({"role": "user", "content": question})

    const data = {
        "organisationId": window.ENV.organisation_id,
        "kbId": window.ENV.kb_id,
        "url": query_ai_focus_url,
        "urlId": query_ai_focus_url_id,
        "conversationList": conversationList,
        "answer": "",
    }
    const headers = {
        "API-Version": window.ENV.api_version,
        "Content-Type": "application/json",
        "session-id": session_id
    }
    const url = window.ENV.api_base + '/semantic/document-qa'
    $.ajax({
        url: url,
        type: 'POST',
        data: JSON.stringify(data),
        headers: headers,
        success: function(response) {
            if (response && response.answer && response.conversationList.length > 0) {
                let list = copy(query_ai_dialog_list);
                list.push({"role": "user", "content": response.conversationList[response.conversationList.length - 1].content});
                list.push({"role": "assistant", "content": response.answer});
                query_ai_dialog_list = list;
                set_text();
            }
        },
        error: function(xhr) {
            set_error('ask-ai failed', xhr.responseText)
        }
    });
}

/**
 * combine url and title into one string if possible
 * @returns string
 */
function get_document_name() {
    if (query_ai_focus_title && query_ai_focus_title.length > 0) {
        return "\"" + query_ai_focus_title + "\" (" + get_archive_child(query_ai_focus_url) + ")";
    }
    return query_ai_focus_url;
}

// hide the window
function close_query_ai() {
    const ai_dialog = $('#aiChat');
    ai_dialog.removeClass("show").addClass("d-none");
    query_ai_focus_url = "";
    query_ai_showing = false;
}

// set focus on the document ai box and clear it
function focus_document_ai() {
    if (query_ai_showing) {
        setTimeout(() => {
            const ai_user_text_ctrl = $("#ai_user_text");
            ai_user_text_ctrl.val("");
            ai_user_text_ctrl.focus();
        }, 500)
    }
}

// set up the text in the content dialog
function set_text() {
    const chat_content = $("#chat-content");
    chat_content.empty();
    query_ai_dialog_list.map((msg, i) => {
        if (msg && msg.role === "assistant") {
            const content = msg.content.replace("%doc%", get_document_name());
            chat_content
                .append(`<div class="ai-message bot-message">${content}</div`)
        } else {
            chat_content
                .append(`<div class="ai-message user">${msg.content}</div`)
        }
    })
    focus_document_ai();
}

// show the query AI window
function show_query_ai(url, url_id, title) {
    if (url && url.length > 0 && url_id > 0) {
        query_ai_focus_url = url;
        query_ai_focus_url_id = url_id;
        query_ai_focus_title = title;
        query_ai_dialog_list = [{"role": "assistant", "content": "Please ask me any question about %doc%"}];
        const ai_dialog = $('#aiChat');
        ai_dialog.removeClass("d-none").addClass("show");
        set_text();
        query_ai_showing = true;
        focus_document_ai();
    }
}

function check_user_key(event) {
    const ai_text = $("#ai_user_text").val();
    if (event.key === "Enter" && ai_text.trim().length > 2) {
        event.preventDefault();
        event.stopPropagation();
        ask_ai(ai_text.trim())
    }
}

