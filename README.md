
# SimSage search-js
A simple jQuery, bootstrap, keycloak implementation of display SimSage search results.
A simple SimSage search UX.

## settings.js
This is the settings file that needs to be changed / modified to talk to SimSage.

| name                      | value                                | description                                                                       |
|---------------------------|--------------------------------------|-----------------------------------------------------------------------------------|
| version                   | 7.18                                 | Current version of SimSage                                                        |
| api_version               | 1                                    | API version of SimSage, must be 1                                                 |
| app_title                 | SimSage Search                       | HTML page title                                                                   |
| api_base                  | http://localhost:8080/api            | remote SimSage SaaS server location, e.g. https://demo2.simsage.ai/api            |
| organisation_id           | a176f683-e1cd-23af-9009-cf8b6df9c271 | SimSage organisation ID to use for searching                                      |
| kb_id                     | 2daa1c79-70aa-3322-cd61-12349ca5defa | SimSage knowledge-base ID to use for searching                                    |
| max_word_distance         | 40                                   | maximum allowed distance between words for success/failure                        |
| page_size                 | 10                                   | number of search results returned per query                                       |
| use_spell_checker         | true                                 | show spelling suggestions if nothing found and available                          |
| use_insight               | false                                | use insights instead of AI Q&A answers                                            |
| use_article_summary       | false                                | show a summarize article button if enabled                                        |
| show_user_tags            | false                                | show user added tags                                                              |
| session_length_in_minutes | 30                                   | length of a session in minutes, should be less than keycloak's own default length |
| kc_realm                  | simsage-test                         | keycloak realm name                                                               |
| kc_client_id              | simsage-test-client                  | keycloak client inside realm name                                                 |
| kc_endpoint               | https://security.simsage.ai          | keycloak server url                                                               |

## testing using a local http server
```
npm install http-server -g
http-server -p 4201 --cors --hot --host 0.0.0.0 --disableHostCheck true
```
