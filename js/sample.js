export const SAMPLE = `# Project Status Report

A short sample that uses most Markdown features. Edit it, paste your own text, or upload a \`.md\` file.

## Summary

The **pilot** finished on schedule. *Throughput* rose by 18 %, and the ~~manual~~ export step is now automated.
See the [project page](https://example.com/project) for details.

> Measured results are from the second test week.
> Earlier numbers were affected by a configuration error.

## Milestones

1. Requirements signed off
2. Prototype built
   - Hardware bring-up
   - Software integration
     - Control plane
     - Data plane
3. Field trial

### Open items

- [x] Update the user guide
- [ ] Review the security findings
- [ ] Plan the next release

## Results

| Metric        | Target | Measured | Status |
|:--------------|-------:|---------:|:------:|
| Throughput    | 40 Mb/s | 47 Mb/s | Pass |
| Latency (p95) | 20 ms  | 17 ms    | Pass |
| Packet loss   | < 1 %  | 1.4 %    | Fail |

![Quarterly throughput](data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzNjAiIGhlaWdodD0iMTQwIiB2aWV3Qm94PSIwIDAgMzYwIDE0MCI+PHJlY3Qgd2lkdGg9IjM2MCIgaGVpZ2h0PSIxNDAiIGZpbGw9IiNmNGY3ZmIiLz48cmVjdCB4PSIzMCIgeT0iNzAiIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgZmlsbD0iIzJmNmZhYiIvPjxyZWN0IHg9IjExMCIgeT0iNDAiIHdpZHRoPSI1MCIgaGVpZ2h0PSI4MCIgZmlsbD0iIzJmNmZhYiIvPjxyZWN0IHg9IjE5MCIgeT0iNTUiIHdpZHRoPSI1MCIgaGVpZ2h0PSI2NSIgZmlsbD0iIzJmNmZhYiIvPjxyZWN0IHg9IjI3MCIgeT0iMjAiIHdpZHRoPSI1MCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMyZjZmYWIiLz48dGV4dCB4PSIxODAiIHk9IjEzNSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjExIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMzMzIj5RMSB0byBRNCB0aHJvdWdocHV0PC90ZXh0Pjwvc3ZnPg==)

## Configuration

Run the tool with \`--verbose\` to see each step:

\`\`\`bash
./deploy.sh --env staging --verbose
\`\`\`

\`\`\`python
def throughput(bytes_sent, seconds):
    """Return throughput in Mb/s."""
    return bytes_sent * 8 / seconds / 1e6
\`\`\`

---

#### Heading level 4
##### Heading level 5
###### Heading level 6

Special characters: & < > " ' — “quotes”, € £ ¥, Ä Ö Ü, 日本語.
`;
