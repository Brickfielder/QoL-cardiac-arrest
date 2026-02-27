# Abstract Calibration Screener

Simple browser tool for screening RIS records one-by-one in random order.

## Use

1. Open `screening-ui/index.html` in a browser.
2. Select your calibration `.ris` file and click **Load File**.
3. For each abstract, choose **Accept**, **Unsure**, or **Decline**.
4. When all records are screened, download decisions as CSV or JSON.

## Notes

- DOI links are shown when a DOI is present (field `DO`) or can be extracted from a URL.
- Progress is saved in browser `localStorage` per file, so a user can resume later.
- `Restart Session` clears decisions for the currently loaded file and reshuffles records.
