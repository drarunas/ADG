// extract page parameters from a form
function getPageParams(form) {
    // Helper function to get value by name
    const getValueByName = (name) => {
        const element = form.querySelector(`[name="${name}"]`);
        return element ? element.value : null;
    };

    // Getting values for each form input
    const formType = getValueByName("form_type");
    const jId = getValueByName("j_id");
    const msId = getValueByName("ms_id");
    const msRevNo = getValueByName("ms_rev_no");
    const msIdKey = getValueByName("ms_id_key");
    const ndt = getValueByName("ndt");
    const currentStageId = getValueByName("current_stage_id");
    const desiredRevCnt = getValueByName("desired_rev_cnt");

    // Returning an object with all the gathered values
    return {
        formType,
        jId,
        msId,
        msRevNo,
        msIdKey,
        ndt,
        currentStageId,
        desiredRevCnt,
    };
}

// get reviewer email from ejp
// requires person hreft on ejp, e.g.
//https://mts-ncomms.nature.com/cgi-bin/main.plex?form_type=biblio_dump&j_id=18&ms_id=482895&ms_rev_no=0&ms_id_key=ftdzfYUcGTTnVM9iw67uXKNA&auth_id=2510095
async function eJPGetEmail(nameHref) {
    try {
        const response = await fetch(nameHref);
        if (!response.ok) throw new Error("Failed to fetch page");

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const mailtoLink = doc.querySelector('a[href^="mailto:"]');

        if (mailtoLink) {
            const email = mailtoLink
                .getAttribute("href")
                .replace("mailto:", "");
            console.log(email)
            return email;
        }
        return null; // Return null if no email found
    } catch (error) {
        console.error("Error opening page or parsing email:", error);
        return null; // Return null in case of error
    }
}

// search person on eJP by fname lname email inst
async function eJPPersonSearch(
    fname,
    lname,
    email,
    inst,
    jId,
    msId,
    msRevNo,
    msIdKey,
    currentStageId,
    desiredRevCnt
) {
    const requestBody = `form_type=assign_rev_tab_view_store&j_id=${encodeURIComponent(
        jId
    )}&ms_id=${encodeURIComponent(msId)}&ms_rev_no=${encodeURIComponent(
        msRevNo
    )}&ms_id_key=${encodeURIComponent(
        msIdKey
    )}&current_stage_id=${encodeURIComponent(
        currentStageId
    )}&input_fname=${encodeURIComponent(
        fname
    )}&input_lname=${encodeURIComponent(
        lname
    )}&input_email=${encodeURIComponent(email)}&input_org=${encodeURIComponent(
        inst
    )}&desired_rev_cnt=${encodeURIComponent(desiredRevCnt)}&action=Search`;

    try {
        const response = await fetch(
                $('#nf_assign_rev').attr('action'),
            {
                method: "POST",
                headers: {
                    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                    "accept-language": "en-US,en;q=0.9",
                    "cache-control": "max-age=0",
                    "content-type": "application/x-www-form-urlencoded"
                },
                body: requestBody,
                referrer: $('#nf_assign_rev').attr('action'),
                referrerPolicy: "strict-origin-when-cross-origin",
                mode: "cors",
                credentials: "include"
            }
        );
        if (!response.ok) {
            throw new Error("Network response was not ok.");
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const table = doc.querySelector("#artv_search_results_tbl");

        // Check if the table exists
        if (!table) {
            console.log("Table #artv_search_results_tbl not found.");
            return null; // Or return []; if you prefer an empty array
        }

        const rows = table.querySelectorAll("tbody > tr");
        const extractedData = Array.from(rows).map((row) => {
            const cells = row.querySelectorAll("td");
            const nameLink = cells[1].querySelector("a"); // First <a> tag in the name cell
            const organizationCell = cells[2];

            // Extract auth_id from the href attribute of the name link
            const authIdMatch = nameLink.href.match(/auth_id=(\d+)/);
            const authId = authIdMatch ? authIdMatch[1] : null;

            return {
                name: nameLink.innerText.trim(), // Use the text from the first <a> tag as the name
                authId: authId,
                organization: organizationCell.innerText.trim(),
                //assigned: cells[3].innerText.trim(),
                //invited: cells[4].innerText.trim(),
                pending: cells[5].innerText.trim(),
                //completed: cells[6].innerText.trim(),
                averageDuration: cells[7].innerText.trim(),
                //averageRanking: cells[8].innerText.trim(),
                conflicts: cells[9].innerText.trim(),
                //notes: cells[10].innerText.trim()
                nameHref: nameLink.href
            };
        });

        return extractedData; // Return the data for subsequent processing
    } catch (error) {
        console.error("Error during fetch operation:", error);
        return null; // Or return []; if you prefer an empty array
    }
}

// separate first name and initial from fname
function separateNameAndInitial(fullName) {
    const parts = fullName.trim().split(" ");
    let firstName = parts[0]; // Assume the first part is always the first name
    let middleInitials = "";

    // Check if there are parts of the name that could be initials
    if (parts.length > 1) {
        // Filter parts that are likely initials (e.g., "J.", "K.L.", etc.)
        const initialParts = parts.slice(1).filter(part => part.match(/^[A-Z]\.?$/i) || part.includes("."));
        // Join the initials with spaces
        middleInitials = initialParts.join(" ");
        // Everything before the first initial is considered part of the first name
        const nonInitialPartsIndex = parts.findIndex(part => initialParts.includes(part));
        firstName = parts.slice(0, nonInitialPartsIndex).join(" ");
    }
    console.log(middleInitials);
    console.log(firstName);
    return { firstName, middleInitials };
}

// assign reviewer using requests
async function fetchNatureData(requestBody) {
    const response = await fetch(
        $('#nf_assign_rev').attr('action'),
        {
            method: "POST",
            headers: {
                accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "accept-language": "en-US,en;q=0.9",
                "cache-control": "max-age=0",
                "content-type": "application/x-www-form-urlencoded"
            },
            referrer: $('#nf_assign_rev').attr('action'),
            referrerPolicy: "strict-origin-when-cross-origin",
            body: requestBody,
            mode: "cors",
            credentials: "include"
        }
    );

    // Check if the response was ok (status in the range 200-299)
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }

    return response; // or await response.json() if you expect a JSON response
}

function createSpinner() {
    //const spinner=document.createElement("div");
    const spinner = document.createElement("div");
    spinner.className = "dot-spinner";
    for (let i = 0; i < 4; i++) {
        const dot = document.createElement("div");
        spinner.appendChild(dot);
    }
    return spinner;
}

// Function to create the loader overlay
function createLoaderOverlay() {
    // Create the overlay with a specific class for styling
    const overlay = document.createElement("div");
    overlay.className = 'loader-overlay'; // Add a class for the overlay

    // Create and append the divs for the loader
    for (let i = 0; i < 9; i++) {
        const div = document.createElement("div");
        div.className = 'loader'; // Add a class for loader divs
        overlay.appendChild(div);
    }
    return overlay;
}

function blinkButton(selector, times) {
    $(selector).css('animation-iteration-count', times * 2); // Each blink is a cycle of appearing and disappearing, hence times * 2
    $(selector).addClass("blink");
    // Optional: Remove the class after the animation ends, if you don't want the style to persist
    setTimeout(() => {
        $(selector).removeClass("blink");
    }, times * 1000 * 2); // Duration should match the CSS animation-duration * number of blinks
}

// e.g. removeNbsp('.main-div table div);
function removeNbsp(element) {
    $(element).contents().each(function() {
        if (this.nodeType === 3) { // Node type 3 is a text node
            this.nodeValue = this.nodeValue.replace(/\u00A0/g, ''); // Replace &nbsp; with a regular space
        } else if (this.nodeType === 1) { // Node type 1 is an element
            removeNbsp(this); // Recursively check child elements
        }
    });
}


async function getMSDetails() {
    const scripts = $('p > script');
    let paramsString = null;
    const regex = /details_ajax_js[^{]*{[^}]*var params\s*=\s*'([^']*)'\s*\+\s*time;/s;

    for (let script of scripts) {
      const scriptContent = script.textContent || script.innerText;
      const match = regex.exec(scriptContent);
      if (match && match[1]) {
        // Found the params variable assignment
        paramsString = match[1];
        break;
      }
    }
  
    if (!paramsString) {
      console.log("Could not find 'params' within details_ajax_js function.");
      return {}; // Return an empty object if paramsString wasn't found
    }

    // Since $.ajax is used, wrap the AJAX call in a new Promise
    return new Promise((resolve, reject) => {
      $.ajax({
        url: "cgi-bin/main.plex",
        type: "POST",
        data: paramsString,
        success: function(response) {
            const titleValuePairs = {};
            var tempDiv = $('<div></div>');
            tempDiv.html(response);
        
            // Now, find the table within the tempDiv
            var table = tempDiv.find('table:first');
  
            $(table).find('tr').each(function() {
              const title = $(this).find('th:first').text().trim();
              const value = $(this).find('td:first').text().trim();
              if (title && value) {
                titleValuePairs[title] = value;
              }
            });

            resolve(titleValuePairs); // Resolve the promise with the titleValuePairs object
        },
        error: function(xhr, status, error) {
          console.error("AJAX Error:", status, error);
          reject(error); // Reject the promise on error
        }
      });
    });
}


async function getMSTasks() {
    const scripts = $('p > script');
    let paramsString = null;
    const regex = /tasks_ajax_js[^{]*{[^}]*var params\s*=\s*'([^']*)'\s*\+\s*time;/s;

    for (let script of scripts) {
      const scriptContent = script.textContent || script.innerText;
      const match = regex.exec(scriptContent);
      if (match && match[1]) {
        // Found the params variable assignment
        paramsString = match[1];
        break;
      }
    }
  
    if (!paramsString) {
      console.log("Could not find 'params' within tasks_ajax_js function.");
      return {}; // Return an empty object if paramsString wasn't found
    }

    // Since $.ajax is used, wrap the AJAX call in a new Promise
    return new Promise((resolve, reject) => {
      $.ajax({
        url: "cgi-bin/main.plex",
        type: "POST",
        data: paramsString,
        success: function(response) {
            var tempDiv = $('<div></div>');
            tempDiv.html(response);
            
            // Create an ordered list
            var resOl = $('<ul></ul>');
            
            // Find all 'a' elements and append them to the ordered list, each wrapped in an 'li'
            tempDiv.find('a').each(function() {
                var listItem = $('<li></li>').append($(this));
                resOl.append(listItem);
            });
        
            // Resolve with the ordered list
            resolve(resOl);
        },
        error: function(xhr, status, error) {
          console.error("AJAX Error:", status, error);
          reject(error); // Reject the promise on error
        }
      });
    });
}


function table_to_div(table) {
    // Find the table element
  // Find the table element
  const $table = $(table);

  // Create a new div to hold the converted content
  const $divContainer = $('<div class="container"></div>');

  // Iterate over each row in the table
  $table.find('tr').each(function() {
    const $row = $(this);
    const $header = $row.find('th').html(); // Get the header content
    const $value = $row.find('td').html(); // Get the value content

    // Create and append a div for the header
    if ($header) { // Check if header exists to handle rows with no <th>
      const $headerDiv = $('<h6 mb-1"></h6>').html($header);
      $divContainer.append($headerDiv);
    }
    
    // Create and append a div for the value
    if ($value) { // Check if value exists to handle rows with no <td>
      const $valueDiv = $('<div class="mb-3"></div>').html($value);
      $divContainer.append($valueDiv);
    }
          // Append a stylized horizontal line using Bootstrap's border and margin utilities
          const $hr = $('<div class="border-top my-3"></div>');
          $divContainer.append($hr);
  });

    
    // Replace the table with the new div container
    return $divContainer;
 
  }
  

  