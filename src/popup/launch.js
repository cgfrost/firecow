(function () {
    'use strict';

    const daysOfTheWeek = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday'
    ];

    const ANDROID = 'android';
    let isMobile = false;
    let validationRegex = new RegExp('^https?://');
    let activeTimeout = undefined;
    let desktopSelectionCode = 'window.getSelection().toString()';

    // Sections
    let addTaskSection = document.getElementById('content');
    let addListSection = document.getElementById('add-list');
    let loginSection = document.getElementById('login');
    let statusSection = document.getElementById('status');

    // Buttons
    let addListSubmitButton = document.getElementById('add-list-submit');
    let addListCancelButton = document.getElementById('add-list-cancel');
    let addTaskSubmitButton = document.getElementById('add-task-submit');
    let permissionSubmitButton = document.getElementById('permissions-submit');
    let listRefreshButton = document.getElementById('lists-refresh');
    let listRefreshButtonImg = listRefreshButton.firstElementChild;
    let listPlusButton = document.getElementById('lists-plus');
    let optionsButton = document.getElementById('options');

    // Status
    let statusMsg = document.getElementById('status-msg');
    let statusImg = document.getElementById('status-img');

    // Add Task Form Elements
    let taskElement = document.getElementById('task');
    let taskLabel = document.getElementById('task-label');
    let linkElement = document.getElementById('link');
    let linkLabel = document.getElementById('link-label');
    let listsElement = document.getElementById('lists');
    let selectedElement = document.getElementById('selected-text');
    let selectedLabel = document.getElementById('selected-text-label');
    let dueDateElement = document.getElementById('due-date');
    let dueDateLabel = document.getElementById('due-date-label');

    // Add List Form Elements
    let addListElement = document.getElementById('list');
    let addListLabel = document.getElementById('list-label');
    let addListStatusImg = document.getElementById('add-list-status-img');

    function handleFatalError(error, altAction) {
        let errorMessage = error.message ? error.message : error.toString();
        console.warn(`Moo Later fatal error: ${errorMessage}`);
        showMessageThen(`Failed: ${errorMessage}`, 'error', altAction);
    }

    function log(message, debugMode) {
        if (debugMode) {
            console.log(message);
        }
    }

    // Initialization
    document.addEventListener('DOMContentLoaded', () => {

        browser.runtime.getPlatformInfo().then((info) => {
            if(ANDROID === info.os) {
                isMobile = true;
                document.body.style.fontSize = '2.4em';
                document.body.style.width = '100%';
                let icons = document.querySelectorAll("button.icon img");
                for (let i = 0; i < icons.length; i++) {
                    icons[i].style.width = '5.4em';
                    icons[i].style.height = '5.4em';
                }
            }
        });

        taskElement.addEventListener('keyup', (event) => {
            if (event.keyCode === 13) {
                linkElement.focus();
            }
        }, false);

        linkElement.addEventListener('keyup', (event) => {
            if (event.keyCode === 13) {
                dueDateElement.focus();
            }
        }, false);

        dueDateElement.addEventListener('keyup', (event) => {
            if (event.keyCode === 13) {
                addTaskSubmitButton.focus();
            }
        }, false);

        addListElement.addEventListener('keyup', (event) => {
            if (event.keyCode === 13) {
                addListSubmitButton.focus();
            }
        }, false);

        optionsButton.addEventListener('click', () => {
            browser.runtime.openOptionsPage().then(() => {
                closeMe();
            });
        }, false);

        browser.runtime.sendMessage({action: "userReady"}).then((response) => {
            if (response){
                showAddTask();
            } else {
                showSection(loginSection);
            }
        }).catch(handleFatalError);

        addListSubmitButton.addEventListener('click', () => {
            if (addListElement.value !== '') {
                setIconState(addListStatusImg, 'loading');
                setTextElement(addListLabel, 'New List:');
                addListSubmitButton.disabled = true;
                addListCancelButton.disabled = true;
                let addListArguments = {
                    action: 'addList',
                    listName: addListElement.value
                };
                browser.runtime.sendMessage(addListArguments).then(() => {
                    setTimeout(() => {
                        showSection(addTaskSection);
                    }, 500);
                }).catch((error) => {
                    handleFatalError(error, showAddTask);
                });
            } else {
                setTextElement(addListLabel, 'New List: List name can\'t be empty.');
            }
        }, false);

        addListCancelButton.addEventListener('click', () => {
            showSection(addTaskSection);
        }, false);

        addTaskSubmitButton.addEventListener('click', () => {
            let formValid = true;
            if (taskElement.value !== '') {
                setTextElement(taskLabel, 'Task name:');
            } else {
                setTextElement(taskLabel, 'Task: Task name can\'t be empty.');
                formValid = false;
            }
            if (linkElement.value === '' || validationRegex.test(linkElement.value)) {
                setTextElement(linkLabel, 'Link:');
            } else {
                setTextElement(linkLabel, 'Link: Links must start with \'http://\' or \'https://\'.');
                formValid = false;
            }
            if (formValid) {
                showMessage('Sending the task to RTM', 'loading');
                activeTimeout = setTimeout(() => {
                    showMessage('Still sending the task to RTM...', 'loading');
                }, 3000);
                let addTaskArguments = {
                    action: 'addTask',
                    name: taskElement.value,
                    link: linkElement.value,
                    dueDate: dueDateElement.value,
                    useSelection: selectedElement.checked,
                    selection: selectedElement.value,
                    listId: listsElement.value
                };
                browser.runtime.sendMessage(addTaskArguments).catch(handleFatalError);
            }
        }, false);

        permissionSubmitButton.addEventListener('click', () => {
            showMessage('Requesting permission', 'loading');
            browser.runtime.sendMessage({action: "authorise"}).catch(handleFatalError);
        }, false);

        listRefreshButton.addEventListener('click', () => {
            setIconState(listRefreshButtonImg, 'loading');
            browser.runtime.sendMessage({action: "refreshLists"}).catch(() => {
                setIconState(listRefreshButtonImg, 'error');
                setTimeout(() => {
                    setIconState(listRefreshButtonImg, 'refresh');
                }, 1000);
            });
        }, false);

        listPlusButton.addEventListener('click', () => {
            setTextElement(addListLabel, 'New List:');
            setIconState(addListStatusImg, 'blank');
            addListSubmitButton.disabled = false;
            addListCancelButton.disabled = false;
            addListElement.value = '';
            showSection(addListSection);
        }, false);

    });

    function handleMessage(message, sender) {
        log(`Message received in the popup script: ${message.action} - ${sender.id}`, message.debug);
        switch(message.action) {
        case "listsRefreshed":
            browser.storage.local.get('defaultList').then((setting) => {
                updateLists(message.lists, setting.defaultList, message.debug);
                setIconState(listRefreshButtonImg, 'done');
                setTimeout(() => {
                    setIconState(listRefreshButtonImg, 'refresh');
                }, 1000);
            }).catch(handleFatalError);
            break;
        case "listsRefreshedError":
            browser.storage.local.get('defaultList').then((setting) => {
                updateLists(message.lists, setting.defaultList, message.debug);
                setIconState(listRefreshButtonImg, 'error');
                setTimeout(() => {
                    setIconState(listRefreshButtonImg, 'refresh');
                }, 1000);
            }).catch(handleFatalError);
            break;
        case "userSettingsRefreshed":
            updateDueDates(message.settings);
            break;
        case "taskAdded":
            showMessageThen('Task added', 'done');
            break;
        case "taskAddedError":
            showMessageThen(`Error: ${message.reason}`, 'error');
            break;
        default:
            console.log(`Unrecognised message with query "${message.action}"`);
        }
    }

    let showMessageThen = (message, icon, then) => {
        showMessage(message, icon);
        setTimeout(() => {
            if (then) {
                then();
            } else {
                closeMe()
            }
        }, 1000);
    };

    let closeMe = () => {
        if (isMobile) {
            browser.tabs.getCurrent().then((myTab) => {
                browser.tabs.remove(myTab.id).catch((error) => {
                    console.warn(`Moo Later closing error: ${error.message}`);
                });
            });
        } else {
            window.close();
        }
    };

    let showMessage = (message, icon) => {
        if (activeTimeout) {
            clearTimeout(activeTimeout);
            activeTimeout = undefined;
        }
        setTextElement(statusMsg, message);
        setIconState(statusImg, icon);
        showSection(statusSection);
    };

    let showSection = (element) => {
        let sections = document.getElementsByClassName("section");
        for (let section of sections) {
            section.classList.add('hide');
        }
        element.classList.remove('hide');
    };

    let setIconState = (icon, iconName) => {
        icon.setAttribute('src', '../images/' + iconName + '.svg');
    };

    let setTextElement = (label, text) => {
        let firstTextElement;
        let children = label.childNodes;
        for (let child of children) {
            if (child.nodeName === '#text') {
                firstTextElement = child;
                break;
            }
        }
        if (firstTextElement) {
            label.replaceChild(document.createTextNode(text), firstTextElement);
        } else {
            label.appendChild(document.createTextNode(text));
        }
    };

    let showAddTask = () => {
        browser.storage.local.get().then((settings) => {
            browser.runtime.sendMessage({action: "lists"}).then((lists) => {
                if(isMobile) {
                    browser.tabs.query({active: true}).then((activeTabs) => {
                        prePopulateAddTask(settings, activeTabs, lists);
                    });
                } else {
                    browser.windows.getCurrent({populate: true}).then((currentWindow) => {
                        prePopulateAddTask(settings, currentWindow.tabs, lists);
                    });
                }
            });
            browser.runtime.sendMessage({action: "userSettings"}).then((userSettings) => {
                updateDueDates(userSettings)
            });
        }).catch(handleFatalError);
    };

    let prePopulateAddTask = (settings, tabs, lists) => {
        let activeTab = getActiveTab(tabs);
        let link =  activeTab.url;
        if (link.startsWith('about:')) {
            populateAddTask(settings, '', activeTab, undefined);
        } else {
            browser.tabs.executeScript(activeTab.id, {code: desktopSelectionCode}).then((selection) => {
                populateAddTask(settings, link, activeTab, `${selection}`);
            }, (error) => {
                populateAddTask(settings, link, activeTab, undefined);
                console.log(`Got selected text error '${error}'`);
            });
        }
        updateLists(lists, settings.defaultList);
        showSection(addTaskSection);
    };

    let getActiveTab = (tabs) => {
        if (tabs.length === 0) {
            handleFatalError('No open tab found.');
        }
        if (tabs.length === 1) {
            return tabs[0];
        }
        let tabToSend = tabs[0];
        for (let i = 1; i < tabs.length; i++) {
            if (tabs[i].active && tabs[i].lastAccessed >= tabToSend.lastAccessed) {
                tabToSend = tabs[i];
            }
        }
        return tabToSend;
    };

    let populateAddTask = (settings, link, activeTab, selectedText) => {
        setTextElement(taskLabel, 'Task name:');
        setTextElement(linkLabel, 'Link:');
        setTextElement(dueDateLabel, 'Due date:');
        taskElement.value = settings.useTitle === true ? activeTab.title : '';
        linkElement.value = settings.useLink === true ? link : '';
        taskElement.focus();
        if (selectedText && selectedText.length > 0) {
            selectedElement.checked = true;
            selectedElement.value = selectedText;
            selectedLabel.classList.remove('hide');
        } else {
            selectedLabel.classList.add('hide');
        }
    };

    let updateDueDates = (userSettings) => {
        while (dueDateElement.firstChild) {
            dueDateElement.removeChild(dueDateElement.firstChild);
        }
        let userToday;
        if (userSettings.settings.timezone && userSettings.settings.timezone.length !== 0) {
            // Use the users prefered timezone
            userToday = new Date(Date.now() + userSettings.timezoneOffset);
            // console.log(`Users home date in ${userSettings.settings.timezone} is ${userToday.toISOString()}`);
        } else {
            // Fallback to using the users local timezone
            userToday = new Date(); // UTC time.
            userToday.setTime(userToday.getTime() - (userToday.getTimezoneOffset() * 60 * 1000));
            // console.log(`Users local date is ${userToday.toISOString()}`);
        }

        const dueDates = [
            { id: 'due-never', name: 'Never'},
            { id: 'due-0', name: 'Today'},
            { id: 'due-1', name: 'Tomorrow'},
            { id: 'due-2', name: daysOfTheWeek[userToday.getUTCDay() + 2]},
            { id: 'due-3', name: daysOfTheWeek[userToday.getUTCDay() + 3]},
            { id: 'due-4', name: daysOfTheWeek[userToday.getUTCDay() + 4]},
            { id: 'due-7', name: '1 Week'}
        ];
        let defaultFound = false;
        for (let i = 0; i < dueDates.length; i++) {
            let selected = userSettings.settings.defaultduedate === dueDates[i].name.toLowerCase();
            if (selected) {
                defaultFound = true;
            }
            let newOption = createOptionElement(dueDates[i].id, dueDates[i].name, selected);
            dueDateElement.appendChild(newOption);
        }
        if (!defaultFound) {
            dueDateElement.selectedIndex = "0";
        }
    }

    let updateLists = (lists, defaultList, debug) => {
        log(`Updating the lists, default: ${defaultList}`, debug);
        while (listsElement.firstChild) {
            listsElement.removeChild(listsElement.firstChild);
        }
        let defaultFound = false;
        for (let i = 0; i < lists.length; i++) {
            if (lists[i].smart === '0') {
                let selected = defaultList === lists[i].name;
                if (selected) {
                    defaultFound = true;
                }
                let newOption = createOptionElement(lists[i].id, lists[i].name, selected);
                listsElement.appendChild(newOption);
            }
        }
        if (!defaultFound) {
            listsElement.selectedIndex = "0";
        }
    };

    let createOptionElement = (id, name, selected) => {
        let option = document.createElement('option');
        option.value = id;
        let label = document.createTextNode(name);
        option.appendChild(label);
        if (selected) {
            option.setAttribute('selected', 'selected');
        }
        return option;
    };

    browser.runtime.onMessage.addListener(handleMessage);

}());
