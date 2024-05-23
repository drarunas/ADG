
function showResultsPopup(data) {
    // Check if a modal already exists, if so, remove it
    const existingModal = document.getElementById('resultsModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create the modal structure
    const modalHTML = `
  <div class="modal fade" id="resultsModal" tabindex="-1" aria-labelledby="resultsModalLabel" aria-hidden="true">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="resultsModalLabel">Results</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          ${data} <!-- Assuming the response is HTML safe -->
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
        </div>
      </div>
    </div>
  </div>`;

    // Append the modal HTML to the body
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Use Bootstrap's modal JS to show the modal
    const resultsModal = new bootstrap.Modal(document.getElementById('resultsModal'));
    resultsModal.show();
}

// assign reviewer on eJP based on ID and page params
async function assignReviewer(reviewerId, jId, msId, msRevNo, msIdKey, currentStageId) {
    // Assuming these additional values are also needed and obtained earlier
    const requestBody = `form_type=assign_rev_tab_view_store&j_id=${encodeURIComponent(
        jId
    )}&ms_id=${encodeURIComponent(msId)}&ms_rev_no=${encodeURIComponent(
        msRevNo
    )}&ms_id_key=${encodeURIComponent(
        msIdKey
    )}&current_stage_id=${encodeURIComponent(
        currentStageId
    )}&reviewer=${encodeURIComponent(reviewerId)}&action=Assign`;

    try {
        const response = await fetchNatureData(requestBody);
        if (!response.ok) {
            throw new Error("Network response was not ok.");
        }
        const data = await response.text(); // Or response.json() if the response is JSON.
        console.log("Assignment successful");
    } catch (error) {
        console.error("Error during assignment:", error);
    }
}

// when RF button clicked -> reviewerFinderPopup reviewerFinder
function initiateRevFinding() {
    const msDetailsRow = document.querySelector(
        "#ms_details_row_author_information"
    );
    if (!msDetailsRow) {
        console.error("The table row with author information was not found.");
        return;
    }
    const table = msDetailsRow.closest("table"); // Find the closest parent table

    // Function to find sibling TD text based on TH text content
    const findDataByText = (headerText) => {
        const th = Array.from(table.querySelectorAll("th")).find((th) =>
            th.textContent.includes(headerText)
        );
        return th ? th.nextElementSibling.textContent : "Not found";
    };

    // Utility function to clean text
    const cleanText = (text) => {
        // Remove honorifics and content within parentheses
        let cleanedText = text
            .replace(/\b(Dr|Mr|Ms|Mrs|Miss|Professor)\.?\s+/gi, "")
            .replace(/\(.*?\)/g, "")
            .trim();
        // Additional cleaning for extra spaces within names
        cleanedText = cleanedText.replace(/\s{2,}/g, " ");
        return cleanedText;
    };

    // Split and clean individual author names
    const splitAndCleanAuthors = (authorsText) => {
        return authorsText
            .split(",")
            .map((author) => author.trim()) // Trim each author name
            .filter(Boolean); // Remove any empty strings resulting from split
    };

    // Extract, clean, and process the author information
    let contributingAuthorsText = findDataByText("Contributing Author");
    let correspondingAuthorText = findDataByText("Corresponding Author");

    contributingAuthorsText = cleanText(contributingAuthorsText);
    correspondingAuthorText = cleanText(correspondingAuthorText);

    const contributingAuthors = splitAndCleanAuthors(contributingAuthorsText);
    const correspondingAuthor = splitAndCleanAuthors(correspondingAuthorText);

    // Combine and deduplicate author names
    const allAuthorsSet = new Set([
        ...contributingAuthors,
        ...correspondingAuthor
    ]);
    const authors = Array.from(allAuthorsSet).join(", ");

    // Logging or further processing
    console.log({
        title: findDataByText("Title"),
        abstract: findDataByText("Abstract"),
        authors
    });
    reviewerFinder(
        findDataByText("Title"),
        authors,
        findDataByText("Abstract")
    );
    reviewerFinderPopup();
}

// Construct a reviewer list popup after clicking Rev Finder button
function reviewerFinderPopup() {
    // Ensure the modal is only added once
    if ($('#reviewerFinderModal').length === 0) {
        $('body').append(`
  <div class="modal fade" id="reviewerFinderModal" tabindex="-1" aria-labelledby="reviewerFinderModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h4 class="modal-title" id="reviewerFinderModalLabel">📖 Reviewer Finder Shortlist</h4>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <ul class="list-group popupList"></ul>
        </div>
        <div class="modal-footer">
          <button type="button" class="assignSelectedBtn">Assign Selected</button>
        </div>
      </div>
    </div>
  </div>`);
    }

    // Assign Selected button logic
    $('#reviewerFinderModal .assignSelectedBtn').off('click').on('click', function () {
        const $popup = $('#reviewerFinderModal'); // Assuming this is your popup container
        const loaderOverlay = createLoaderOverlay(); // Ensure this function returns a jQuery object or element
        $popup.append(loaderOverlay);

        $(this).remove(); // Remove assign button
        const $list = $popup.find('.popupList');
        $list.css({
            opacity: "0.5",
            backgroundColor: "#f0f0f0" // Light gray background
        });
        const form = document.getElementById("nf_assign_rev");

        const { formType, jId, msId, msRevNo, msIdKey, ndt, currentStageId, desiredRevCnt } = getPageParams(form);
        const operationPromises = [];
        $('.popupList input[type="checkbox"]:checked').each(function () {
            const $checkbox = $(this);
            const status = $checkbox.data('status'); // Using jQuery data method to get 'data-status' value

            if (status === "existing") {
                // Existing reviewer assignment
                const reviewerId = $checkbox.val();
                operationPromises.push(assignReviewer(reviewerId,
                    jId,
                    msId,
                    msRevNo,
                    msIdKey,
                    currentStageId));
            } else if (status === "new") {
                // New reviewer form submission
                const firstName = $checkbox.data('fname');
                const lastName = $checkbox.data('lname');
                const email = $checkbox.data('email');
                const inst = $checkbox.data('inst');

                operationPromises.push(submitFormAssign(firstName, lastName, email, inst));
            }
        });

        Promise.all(operationPromises)
            .then(() => {
                console.log("All reviewers have been successfully assigned.");
                $popup.remove(); // Removes the popup
                // Redirect if needed
                const hosthref = $('#nf_assign_rev').attr('action');
                window.location.href = `${hosthref}?form_type=${formType}&j_id=${jId}&ms_id=${msId}&ms_rev_no=${msRevNo}&ms_id_key=${msIdKey}&current_stage_id=${currentStageId}&show_tab=CurrentList&redirected=1&desired_rev_cnt=${desiredRevCnt}`;
            })
            .catch((error) => {
                console.error("An error occurred during the assignments:", error);
            }).finally(() => {
                // Remove the loader overlay when done
                loaderOverlay.remove();
            });
    });

    // Show the modal using Bootstrap's modal method
    const modalInstance = new bootstrap.Modal(document.getElementById('reviewerFinderModal'));
    modalInstance.show();
}

async function addToShortList(fullName, lastName, email, inst) {
    const $list = $("#reviewerFinderModal .popupList");
    if ($list.length === 0) {
        console.error("Popup list not found.");
        return;
    }
    // populate main result line with restuls from RF
    const emailLowerCase = email.toLowerCase();
    const { firstName, middleInitials } = separateNameAndInitial(fullName);
    const middleInitialPart = middleInitials ? ` ${middleInitials}` : "";

    const $item = $(`
<li class="list-group-item has-nested-ul ">
 
    <input type="checkbox" class="form-check-input pcheck" value="${emailLowerCase}" data-status="new" data-fname="${firstName}" data-lname="${lastName}" data-email="${emailLowerCase}" data-inst="${inst}">
    <span>📒${firstName}${middleInitialPart} ${lastName}, 📧${emailLowerCase}, ${inst}</span>

  <ul class="secondLine"></ul>
</li>`);
    // populate the second level list
    const $secondLine = $item.find(".secondLine");
    const $spinner = $(createSpinner()); // Assuming createSpinner returns an HTML string for the spinner
    $secondLine.append($spinner);
    $list.append($item);

    // try searching for matching authors on eJP
    try {
        const form = document.getElementById("nf_assign_rev");

        const { formType, jId, msId, msRevNo, msIdKey, ndt, currentStageId, desiredRevCnt } = getPageParams(form);
        const searchData = await eJPPersonSearch(firstName, lastName, "", "", jId, msId, msRevNo, msIdKey, currentStageId, desiredRevCnt) || [];
        const searchDataByEmail = await eJPPersonSearch("", "", emailLowerCase, "", jId, msId, msRevNo, msIdKey, currentStageId, desiredRevCnt) || [];

        if ((!searchData || searchData.length === 0) && (!searchDataByEmail || searchDataByEmail.length === 0)) {
            $secondLine.append(`<li>❌ Not on eJP</li>`);
            $item.find('input[type="checkbox"]').prop("checked", true);
        } else {
            if (!searchDataByEmail || searchDataByEmail.length === 0) {
                $secondLine.append($(`<li>❌ Email not on eJP</li>`));
                $item.find('input[type="checkbox"]').prop("checked", true);
            }

            const combinedData = [...searchData, ...searchDataByEmail].filter(element => element !== null);
            const uniqueCombinedData = Array.from(new Map(combinedData.map(item => [item['authId'], item])).values());

            for (const dataItem of uniqueCombinedData) {
                const $resultItem = $(`
<li class="eJPResult ">
  <input type="checkbox" class="form-check-input pcheck" value="${dataItem.authId}" data-status="existing">
  <a href="${dataItem.nameHref}" target="_blank">🦉${dataItem.name}</a>, 🏢${dataItem.organization}
</li>`);

                // Conditionally append additional details
                if (dataItem.pending) $resultItem.append(`,❗ Pending: ${dataItem.pending}`);
                if (dataItem.averageDuration) $resultItem.append(`, 🕓 ${dataItem.averageDuration}`);
                if (dataItem.conflicts) $resultItem.append(`,❗${dataItem.conflicts}`);

                try {
                    const fetchedEmail = await eJPGetEmail(dataItem.nameHref);
                    if (fetchedEmail) {
                        $resultItem.append(`, 📧${fetchedEmail}`);
                    }
                } catch (error) {
                    console.error("Error fetching email:", dataItem.name, error);
                }
                $secondLine.append($resultItem);
            }
        }
    } catch (error) {
        console.error("Error during eJPPersonSearch:", error);
        $secondLine.empty().text("Failed to load data");
    } finally {

        // Reordering and checkbox handling
        $(".eJPResult").each(function () {
            const $li = $(this);
            const emailText = `📧${emailLowerCase}`; // The email to match against
            const alreadyAssignedText = "Already Assigned"; // Text indicating the reviewer is already assigned

            if ($li.text().includes(emailText)) {
                // Move this li to the top of the list
                $li.addClass("matchingLi").prependTo($li.parent());
                $li.find('input[type="checkbox"]').prop("checked", true);
            }

            // Check if "Already Assigned" is mentioned
            if ($li.text().includes(alreadyAssignedText)) {
                // Uncheck and disable the checkbox
                $li.find('input[type="checkbox"]').prop("checked", false).prop("disabled", true);
            }
        });
        $spinner.remove(); // Ensure the spinner is removed after processing
    }
}

// Send a message to open a new RF tab
function reviewerFinder(title, authors, abstract, MTSid) {
    chrome.runtime.sendMessage({
        action: "openReviewerFinder",
        data: { title, authors, abstract, MTSid }
    });
}

// Listen to bg message with rev details, add them to shortlist in popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "reviewerDetails") {
        const { firstName, lastName, inst, email, uniqueId } = message.data;
        const senderTabId = message.senderTabId;
        console.log("received in mts", message.data);
        addToShortList(firstName, lastName, email, inst);
        chrome.runtime.sendMessage({
            action: "reviewerAssignmentComplete",
            status: "success",
            uniqueId: uniqueId, // Include the uniqueId in the response
            tabId: senderTabId // Include the sender tab ID if not already tracked
        });
    }
});

// Submits the forms via POST that actually assign revs on eJP
async function submitFormAssign(firstName, lastName, email, inst) {
    const form = document.getElementById("nf_assign_rev");

    const { formType, jId, msId, msRevNo, msIdKey, ndt, currentStageId, desiredRevCnt } = getPageParams(form);

    // Constructing the request body
    const requestBody = `form_type=${encodeURIComponent(
        formType
    )}&j_id=${encodeURIComponent(jId)}&ms_id=${encodeURIComponent(
        msId
    )}&ms_rev_no=${encodeURIComponent(msRevNo)}&ms_id_key=${encodeURIComponent(
        msIdKey
    )}&ndt=${encodeURIComponent(ndt)}&current_stage_id=${encodeURIComponent(
        currentStageId
    )}&first_nm=${encodeURIComponent(firstName)}&last_nm=${encodeURIComponent(
        lastName
    )}&org=${encodeURIComponent(inst)}&desired_rev_cnt=${encodeURIComponent(
        desiredRevCnt
    )}&email=${encodeURIComponent(email)}&action=Add+Person+Check`;

    try {
        console.log("assigning new");
        const response = await fetchNatureData(requestBody);

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // Check for the existence of a span with class "MSG"
        const msgSpan = doc.querySelector("span.MSG");
        const tableExists =
            doc.querySelector("#artv_search_results_tbl") !== null;

        if (
            msgSpan &&
            msgSpan.textContent.includes("Possible matching accounts found") &&
            tableExists
        ) {
            const inputRadio = doc.querySelector(
                'input[type="radio"][name="reviewer"]'
            );
            if (inputRadio) {
                const reviewerId = inputRadio.value;
                console.log("Reviewer ID:", reviewerId);

                // Call assignReviewer with all necessary parameters
                await assignReviewer(
                    reviewerId,
                    jId,
                    msId,
                    msRevNo,
                    msIdKey,
                    currentStageId
                );
            } else {
                console.log("No matching input element found.");
            }
        } else {
            // Handle cases without matching accounts or redirection
            // [Your existing logic for handling these cases]
        }
    } catch (error) {
        console.error("Error in fetch operation:", error);
    }
}

$(document).ready(function () {
    // Check if the specific element exists
    if ($("#nf_assign_rev").length > 0) {
        console.log("Rev Finder button");
        // HTML for the Reviewer Finder button
        var reviewerFinderButtonHTML = '<button id="reviewerFinderBtn" class="mb-2" title="Reviewer Finder">🔎 Reviewer Finder</button>';

        // Append the Reviewer Finder button to the existing top bar
        $("#nf_assign_rev").prepend(reviewerFinderButtonHTML);
        // Blink the button 5 times
        blinkButton("#reviewerFinderBtn", 5);

        // Add click event listener for the Reviewer Finder button
        $("#reviewerFinderBtn").click(function () {
            sendEvent('rfinitiated', '1').catch(console.error);
            initiateRevFinding();
        });
    }
});

function loadRobotoFont() {
    // Create a <link> element to import the Roboto font from Google Fonts
    var linkElement = document.createElement("link");
    linkElement.href =
        "https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap";
    linkElement.rel = "stylesheet";
    document.head.appendChild(linkElement);
}

const GA_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const MEASUREMENT_ID = `G-3ZRV844YEE`;
const API_SECRET = `fXY6muchQf6nomHF4aTutA`;
const SESSION_EXPIRATION_IN_MIN = 30;
const DEFAULT_ENGAGEMENT_TIME_IN_MSEC = 100;

async function sendEvent(eventname, eventid) {
    chrome.runtime.sendMessage({ action: "getOrCreateClientId" }, response => {
        const clientId = response.clientId;
        chrome.runtime.sendMessage({ action: "getOrCreateSessionId" }, response => {
            const sessionId = response.sessionId;
            
            fetch(`${GA_ENDPOINT}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`, {
                method: "POST",
                body: JSON.stringify({
                    client_id: clientId,
                    events: [{
                        name: eventname,
                        params: {
                            session_id: sessionId,
                            engagement_time_msec: DEFAULT_ENGAGEMENT_TIME_IN_MSEC,
                            id: eventid,
                            hostname: window.location.href
                        },
                    }],
                }),
            }).then(data => {
                console.log('Event sent successfully', eventname, data);
            }).catch(console.error);
        });
    });
}

sendEvent('page_ext_loaded', '0').catch(console.error);