document.addEventListener('DOMContentLoaded', () => {
    // Initialize the map and set its view to the approximate center of Texas
    const map = L.map('map', {
        tap: true,
        touchZoom: true,
        scrollWheelZoom: true
    }).setView([31.9686, -99.9018], 6);

    // Add a tile layer from OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Store daycare data and layers for search functionality
    let daycareData = [];
    let daycareLayers = {};
    let dataLoaded = false;

    // Search functionality
    const searchInput = document.getElementById('daycare-search');
    const searchResults = document.getElementById('search-results');
    const clearSearchBtn = document.getElementById('clear-search');

    function updateClearButton() {
        if (searchInput.value.length > 0) {
            clearSearchBtn.classList.add('visible');
        } else {
            clearSearchBtn.classList.remove('visible');
        }
    }

    function clearSearch() {
        searchInput.value = '';
        searchResults.style.display = 'none';
        updateClearButton();
        searchInput.focus();
    }

    function updateSearchResults(query) {
        updateClearButton();
        searchResults.innerHTML = '';
        
        if (!query || query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }

        if (!dataLoaded) {
            searchResults.innerHTML = '<div class="no-results">Loading daycare data...</div>';
            searchResults.style.display = 'block';
            return;
        }

        const normalizedQuery = query.toLowerCase();
        const matches = daycareData.filter(daycare => 
            daycare.name.toLowerCase().includes(normalizedQuery)
        ).slice(0, 10); // Limit to 10 results

        if (matches.length === 0) {
            searchResults.innerHTML = '<div class="no-results">No daycares found matching "' + query + '"</div>';
        } else {
            matches.forEach(daycare => {
                const resultDiv = document.createElement('div');
                resultDiv.className = 'search-result';
                resultDiv.setAttribute('role', 'button');
                resultDiv.setAttribute('tabindex', '0');
                
                const nameDiv = document.createElement('div');
                nameDiv.className = 'search-result-name';
                nameDiv.textContent = daycare.name;
                
                const addressDiv = document.createElement('div');
                addressDiv.className = 'search-result-address';
                addressDiv.textContent = daycare.address;
                
                resultDiv.appendChild(nameDiv);
                resultDiv.appendChild(addressDiv);
                
                // Handle click
                resultDiv.addEventListener('click', () => {
                    selectDaycare(daycare);
                });
                
                // Handle keyboard (Enter/Space)
                resultDiv.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectDaycare(daycare);
                    }
                });
                
                searchResults.appendChild(resultDiv);
            });
        }

        searchResults.style.display = 'block';
    }

    function selectDaycare(daycare) {
        // Clear search
        searchInput.value = daycare.name;
        searchResults.style.display = 'none';
        updateClearButton();

        // Get the layer for this daycare
        const layer = daycareLayers[daycare.id];
        if (layer) {
            // Zoom to the daycare
            const latLng = layer.getLatLng ? layer.getLatLng() : 
                          (layer.getBounds ? layer.getBounds().getCenter() : null);
            
            if (latLng) {
                map.setView(latLng, 16);
            }

            // Open the popup
            layer.openPopup();
        }
    }

    // Handle input events
    searchInput.addEventListener('input', (e) => {
        updateSearchResults(e.target.value);
    });

    // Clear button
    clearSearchBtn.addEventListener('click', clearSearch);

    // Hide results when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target) && !clearSearchBtn.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });

    // Show results when focusing on input if there's text
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.length >= 2) {
            updateSearchResults(searchInput.value);
        }
    });

    // Handle Enter key in search
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const firstResult = searchResults.querySelector('.search-result');
            if (firstResult) {
                firstResult.click();
            }
        } else if (e.key === 'Escape') {
            searchResults.style.display = 'none';
            searchInput.blur();
        }
    });

    // Prevent zoom on input focus (mobile Safari fix)
    searchInput.addEventListener('focus', function() {
        if (window.innerWidth < 768) {
            document.body.style.zoom = '1';
        }
    });

    // Load the GeoJSON data
    fetch('cacfp_centers_2024-2025.geojson')
        .then(response => response.json())
        .then(data => {
            const geoJsonLayer = L.geoJSON(data, {
                onEachFeature: function (feature, layer) {
                    if (feature.properties) {
                        const props = feature.properties;
                        let popupContent = `<b>${props.sitename}</b>`;
                        
                        let addressParts = [];
                        if (props.sitestreetaddressline1) {
                            popupContent += `<br>${props.sitestreetaddressline1}`;
                            addressParts.push(props.sitestreetaddressline1);
                        }
                        if (props.sitestreetaddresscity) {
                            popupContent += `, ${props.sitestreetaddresscity}`;
                            addressParts.push(props.sitestreetaddresscity);
                        }
                        if (props.sitestreetaddressstate) {
                            popupContent += `, ${props.sitestreetaddressstate}`;
                        }
                        if (props.sitestreetaddresszipcode) {
                            popupContent += ` ${props.sitestreetaddresszipcode}`;
                            addressParts.push(props.sitestreetaddresszipcode);
                        }
                        if (props.totalparticipantsenrolled) {
                            popupContent += `<br>Enrolled Participants: ${props.totalparticipantsenrolled}`;
                        }

                        layer.bindPopup(popupContent);

                        // Store daycare data for search
                        if (props.sitename) {
                            const daycare = {
                                id: props.cesiteid || `${props.sitename}-${props.sitestreetaddressline1}`,
                                name: props.sitename,
                                address: addressParts.join(', ')
                            };
                            daycareData.push(daycare);
                            daycareLayers[daycare.id] = layer;
                        }
                    }
                }
            }).addTo(map);
            
            dataLoaded = true;
            
            // Update placeholder once data is loaded
            if (searchInput.value.length === 0) {
                searchInput.placeholder = `Search ${daycareData.length} daycares by name...`;
            }
        })
        .catch(error => {
            console.error('Error loading the GeoJSON data:', error);
            searchInput.placeholder = 'Error loading data - refresh page';
        });

    // Handle window resize for map
    window.addEventListener('resize', () => {
        map.invalidateSize();
    });

    // Fix for iOS Safari 100vh issue
    function setMapHeight() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    
    setMapHeight();
    window.addEventListener('resize', setMapHeight);
});
