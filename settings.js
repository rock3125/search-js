window.ENV = {
    // SimSage platform version (used for display only in UI)
    version: '7.18',
    // api version of api_base
    api_version: 1,
    // the title of the app, displayed everywhere
    app_title: "SimSage Search",
    // the cloud service layer end-point, change "localhost:8080" to ...
    api_base: 'http://localhost:8080/api',
    // the details of who we are
    organisation_id: "c276f883-e0c8-43ae-9119-df8b7df9c574",
    kb_id: "46ff0c75-7938-492c-ab50-442496f5de51",
    // search parameters
    score_threshold: 0.8125,
    fragment_count: 10,
    max_word_distance: 40,
    page_size: 5,
    // AI support in UX?
    use_ai: true,
    // use spelling suggestions
    use_spell_checker: false,
    // if true, we ask for insights, if false, we ask for Q&A
    use_insight: false,
    // display the summary button if AI is enabled
    use_article_summary: false,
    // show the user tags in the search results?
    show_user_tags: true,
    // cookie storage length
    session_length_in_minutes: 30,
    // keycloak real, client_id and server
    kc_realm: "simsage-test",
    kc_client_id: "simsage-test-client",
    kc_endpoint: "https://security.simsage.ai",
};
